// SPDX-License-Identifier: MIT
// senda SendEscrow v3 — Linkdrop-style ephemeral link key.
//
// The sender's app generates a 32-byte ephemeral LINK KEY client-side; the
// escrow stores its ADDRESS; the claim link fragment (#k=<64 hex>) holds the
// PRIVATE KEY. Claim authorization is the link key's EIP-712 signature over
// Claim(escrowId, payee), produced client-side (no gas, no wallet needed to
// sign) and submitted by the senda relayer (server wallet pays gas).
//
// Why this is safe: the relayer and mempool watchers only ever see
// (id, payee, sig) — never the key. Redirecting to another destination
// requires forging a signature, which requires the key. Replaying observed
// calldata pays the same payee (fund-neutral). Possession of the link IS
// ownership (cash analogy) — a forwarded link hands someone cash.
// Trust model: the relayer can censor/delay, never redirect or steal.
//
// Invariants: checks-effects-interactions everywhere; SafeERC20; custom
// errors only; frozen/paused AUSD reverts atomically (nothing strands —
// sender cancels or expiry reclaim recovers). MIN_TTL stays 10 minutes
// (demo reclaim beat uses a jump-cut, never altered constants).
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "openzeppelin-contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "openzeppelin-contracts/utils/cryptography/ECDSA.sol";

contract SendEscrow is EIP712 {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    bytes32 private constant CLAIM_TYPEHASH =
        keccak256("Claim(uint256 escrowId,address payee)");

    /// @dev Minimum ttl — prevents same-block deposit+reclaim and mid-demo expiry.
    uint40 public constant MIN_TTL = 10 minutes;

    struct Escrow {
        address sender; // can cancel; reclaim target after expiry
        uint96 amount; // AUSD, 6 decimals
        address linkKey; // claim key ADDRESS — its private key lives ONLY in the link fragment
        uint64 expiresAt; // unclaimed funds return via reclaim()
        bool claimed; // terminal once funds leave (claimed, cancelled, or reclaimed)
    }

    IERC20 public immutable ausd;
    uint256 public nextId;
    mapping(uint256 escrowId => Escrow) public escrows;

    // Events power the Envio indexer (TASK-605 history feed) and the Nansen
    // labels panel — off-chain consumers MUST NOT scrape state variables.
    event Deposited(
        uint256 indexed escrowId, address indexed sender, address indexed linkKey, uint96 amount, uint64 expiresAt
    );
    event Claimed(uint256 indexed escrowId, address indexed payee, uint96 amount, address indexed relayer);
    event Cancelled(uint256 indexed escrowId, address indexed sender, uint96 amount);
    event Reclaimed(uint256 indexed escrowId, uint96 amount);

    error NoEscrow();
    error AlreadyClaimed();
    error NotSender();
    error Expired();
    error NotYetExpired();
    error BadAmount();
    error TtlTooShort();
    error BadLinkKeySignature();

    constructor(address ausd_) EIP712("SendEscrow", "1") {
        ausd = IERC20(ausd_);
    }

    /// @notice Sender locks AUSD against an ephemeral link key generated
    /// client-side. If AUSD freezes msg.sender or is paused, safeTransferFrom
    /// reverts and the WHOLE tx reverts atomically — nothing recorded, nothing
    /// stranded.
    function depositTo(address linkKey, uint96 amount, uint40 ttl) external returns (uint256 id) {
        if (amount == 0) revert BadAmount();
        if (ttl < MIN_TTL) revert TtlTooShort();
        if (linkKey == address(0)) revert BadLinkKeySignature();
        id = ++nextId;
        uint64 expiresAt = uint64(block.timestamp) + ttl;
        escrows[id] = Escrow(msg.sender, amount, linkKey, expiresAt, false);
        ausd.safeTransferFrom(msg.sender, address(this), amount); // interaction last (CEI)
        emit Deposited(id, msg.sender, linkKey, amount, expiresAt);
    }

    /// @notice RELAYER submits (server wallet pays gas); the recipient needs
    /// zero MON. `payee` is the recipient's fresh Mera passkey account; `sig`
    /// is the link key's EIP-712 signature over Claim(escrowId, payee). OZ
    /// ECDSA rejects malleated/high-s signatures; the EIP-712 domain (chainId
    /// + this contract) blocks cross-chain/cross-contract replay; the
    /// single-use flag blocks double claims. Frozen/paused AUSD reverts
    /// atomically — retry after unpause, sender cancel, or expiry reclaim.
    function claim(uint256 id, address payee, bytes calldata sig) external {
        Escrow storage e = escrows[id];
        if (e.sender == address(0)) revert NoEscrow();
        if (e.claimed || e.amount == 0) revert AlreadyClaimed();
        if (block.timestamp > e.expiresAt) revert Expired();
        e.claimed = true; // effects before interactions (revert rolls back on bad sig)
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, id, payee)));
        if (digest.recover(sig) != e.linkKey) revert BadLinkKeySignature();
        uint96 amt = e.amount;
        e.amount = 0;
        ausd.safeTransfer(payee, amt);
        emit Claimed(id, payee, amt, msg.sender);
    }

    /// @notice Sender-only refund while unclaimed (sender pays gas).
    function cancel(uint256 id) external {
        Escrow storage e = escrows[id];
        if (e.sender == address(0)) revert NoEscrow();
        if (e.sender != msg.sender) revert NotSender();
        if (e.claimed || e.amount == 0) revert AlreadyClaimed();
        e.claimed = true; // slot burned; funds out below
        uint96 amt = e.amount;
        e.amount = 0;
        ausd.safeTransfer(msg.sender, amt);
        emit Cancelled(id, msg.sender, amt);
    }

    /// @notice Anyone may bounce expired funds back to the sender — a keeper
    /// or the relayer can run this; the sender need not be online.
    function reclaim(uint256 id) external {
        Escrow storage e = escrows[id];
        if (e.sender == address(0)) revert NoEscrow();
        if (block.timestamp <= e.expiresAt) revert NotYetExpired();
        if (e.claimed || e.amount == 0) revert AlreadyClaimed();
        e.claimed = true;
        uint96 amt = e.amount;
        e.amount = 0;
        ausd.safeTransfer(e.sender, amt);
        emit Reclaimed(id, amt);
    }
}
