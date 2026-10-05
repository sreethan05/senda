// SPDX-License-Identifier: MIT
// REFERENCE SKETCH v2 — redesigned after external review (Oct 5).
// Changes vs v1: (1) high-entropy link secret (32 bytes) replaces the 6-digit
// code — a 6-digit codeHash is brute-forceable off-chain, which v1's
// front-running analysis missed; (2) claims are RELAYER-SUBMITTED so a fresh
// recipient account needs zero MON — payee is a parameter bound by the
// payee's EIP-712 signature; (3) phoneHash removed from the contract entirely
// — the phone number is app-layer routing (where the link is sent), never an
// on-chain access control; (4) NoEscrow error instead of misleading
// AlreadyClaimed on nonexistent ids.
//
// Trust model: the relayer pays gas and can censor/delay but can NEVER
// redirect funds — the payee signature binds the destination, and replaying
// a mempool-observed claim pays the same payee. Production would use ERC-4337
// paymasters or redundant relayers; demo ships one server wallet.
//
// TASK-302 implements from this. See docs/RESEARCH_TECH.md §3 and SECURITY.md.
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "openzeppelin-contracts/utils/EIP712.sol";
import {ECDSA} from "openzeppelin-contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/utils/cryptography/MessageHashUtils.sol";

contract SendEscrow is EIP712 {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    bytes32 private constant CLAIM_TYPEHASH =
        keccak256("Claim(uint256 escrowId,bytes32 secretHash,address payee)");

    /// @dev minimum ttl — prevents same-block deposit+reclaim and mid-demo expiry
    uint40 public constant MIN_TTL = 10 minutes;

    struct Escrow {
        address sender;      // can cancel; reclaim target after expiry
        uint96 amount;       // AUSD, 6 decimals
        bytes32 secretHash;  // keccak256(32-byte link secret); secret lives ONLY in the link fragment
        uint64 expiresAt;    // unclaimed funds return via reclaim()
        bool claimed;
    }

    IERC20 public immutable ausd;
    uint256 public nextId;
    mapping(uint256 escrowId => Escrow) public escrows;

    // Events power the Envio indexer (TASK-605 history feed) and the Nansen
    // labels panel — off-chain consumers MUST NOT scrape state variables.
    event Deposited(uint256 indexed escrowId, address indexed sender, uint96 amount, uint64 expiresAt);
    event Claimed(uint256 indexed escrowId, address indexed payee, uint96 amount, address indexed relayer);
    event Cancelled(uint256 indexed escrowId, address indexed sender, uint96 amount);
    event Reclaimed(uint256 indexed escrowId, uint96 amount);

    error NoEscrow();
    error AlreadyClaimed();
    error NotSender();
    error Expired();
    error NotYetExpired();
    error BadSecret();
    error BadSignature();
    error AmountZero();
    error TtlTooShort();

    constructor(address ausd_) EIP712("SendEscrow", "1") {
        ausd = IERC20(ausd_);
    }

    /// @notice sender locks AUSD; sender pays gas (they are the funded party).
    /// If AUSD freezes msg.sender or is paused, safeTransferFrom reverts and
    /// the WHOLE tx reverts atomically — id counter and state roll back,
    /// nothing recorded, nothing stranded.
    function depositTo(bytes32 secretHash, uint96 amount, uint40 ttl)
        external
        returns (uint256 id)
    {
        if (amount == 0) revert AmountZero();
        if (ttl < MIN_TTL) revert TtlTooShort();
        id = ++nextId;
        escrows[id] = Escrow(
            msg.sender,
            amount,
            secretHash,
            uint64(block.timestamp) + ttl,
            false
        );
        ausd.safeTransferFrom(msg.sender, address(this), amount); // interaction last (CEI)
        emit Deposited(id, msg.sender, amount, uint64(block.timestamp) + ttl);
    }

    /// @notice RELAYER submits (server wallet pays gas); recipient may hold
    /// zero MON. `secret` (32 bytes) comes from the link fragment and gates
    /// knowledge; `payee`'s EIP-712 signature binds the destination — a
    /// relayer or mempool observer can never redirect funds, and replaying
    /// the calldata pays the same payee. If AUSD is frozen/paused the tx
    /// reverts atomically and the claim can be retried after unpause (or
    /// sender cancels / expiry reclaim) — nothing can strand.
    function claim(uint256 id, bytes calldata secret, address payee, bytes calldata sig)
        external
    {
        Escrow storage e = escrows[id];
        if (e.sender == address(0)) revert NoEscrow();
        if (e.claimed || e.amount == 0) revert AlreadyClaimed();
        if (block.timestamp > e.expiresAt) revert Expired();
        bytes32 sh = keccak256(secret); // secret: 32 random bytes from the link fragment
        if (sh != e.secretHash) revert BadSecret();
        // effects before interactions
        e.claimed = true;
        // payee's signature over THIS escrow + secretHash + payee: the
        // destination is bound to the signer even though msg.sender is the
        // relayer. OZ ECDSA rejects malleated/high-s signatures.
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, id, sh, payee)));
        if (digest.recover(sig) != payee) revert BadSignature();
        uint96 amt = e.amount;
        e.amount = 0;
        ausd.safeTransfer(payee, amt);
        emit Claimed(id, payee, amt, msg.sender);
    }

    /// @notice sender-only refund while unclaimed (sender pays gas).
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

    /// @notice anyone may bounce expired funds back to the sender — a keeper
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
