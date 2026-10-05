// SPDX-License-Identifier: MIT
// REFERENCE SKETCH — validated design from docs/research (RESEARCH_TECH.md §3).
// TASK-302 implements from this: expect adjustments while writing tests.
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
        keccak256("Claim(uint256 escrowId,bytes32 codeHash,address payee)");

    /// @dev minimum ttl — prevents same-block deposit+reclaim and mid-demo expiry
    uint40 public constant MIN_TTL = 10 minutes;

    struct Escrow {
        address sender;      // can cancel / reclaim target
        uint96 amount;       // AUSD, 6 decimals
        bytes32 phoneHash;   // keccak256(phone ++ salt); salt never on-chain, lives in link (display only)
        bytes32 codeHash;    // keccak256(abi.encodePacked(code)) — 6-digit claim code commitment
        uint64 expiresAt;    // unclaimed funds return via reclaim()
        bool claimed;
    }

    IERC20 public immutable ausd;
    uint256 public nextId;
    mapping(uint256 escrowId => Escrow) public escrows;

    // Events power the Envio indexer (TASK-605 history feed) and the Nansen
    // labels panel — off-chain consumers MUST NOT scrape state variables.
    event Deposited(uint256 indexed escrowId, address indexed sender, bytes32 indexed phoneHash, uint96 amount, uint64 expiresAt);
    event Claimed(uint256 indexed escrowId, address indexed payee, uint96 amount);
    event Cancelled(uint256 indexed escrowId, address indexed sender, uint96 amount);
    event Reclaimed(uint256 indexed escrowId, uint96 amount);

    error AlreadyClaimed();
    error NotSender();
    error Expired();
    error NotYetExpired();
    error BadCode();
    error BadSignature();
    error AmountZero();
    error TtlTooShort();

    constructor(address ausd_) EIP712("SendEscrow", "1") {
        ausd = IERC20(ausd_);
    }

    function depositTo(bytes32 phoneHash, bytes32 codeHash, uint96 amount, uint40 ttl)
        external
        returns (uint256 id)
    {
        if (amount == 0) revert AmountZero();
        if (ttl < MIN_TTL) revert TtlTooShort();
        id = ++nextId;
        escrows[id] = Escrow(
            msg.sender,
            amount,
            phoneHash,
            codeHash,
            uint64(block.timestamp) + ttl,
            false
        );
        // SafeERC20: reverts on failure instead of silent false return.
        // NOTE: escrow state IS written before this interaction (CEI order);
        // if AUSD freezes `msg.sender` or is paused, safeTransferFrom reverts
        // and the WHOLE tx reverts atomically — id counter and escrow state
        // roll back, nothing recorded, nothing stranded.
        ausd.safeTransferFrom(msg.sender, address(this), amount); // interaction last (CEI)
        emit Deposited(id, msg.sender, phoneHash, amount, uint64(block.timestamp) + ttl);
    }

    function claim(uint256 id, string calldata code, bytes calldata sig) external {
        Escrow storage e = escrows[id];
        if (e.claimed || e.amount == 0) revert AlreadyClaimed();
        if (block.timestamp > e.expiresAt) revert Expired();
        bytes32 ch = keccak256(abi.encodePacked(code));
        if (ch != e.codeHash) revert BadCode();
        // effects before interactions
        e.claimed = true;
        // sig from the claiming key over (escrowId, codeHash, payee=me):
        // binds the payee, making front-running fund-neutral (copied tx reverts BadSignature)
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, id, ch, msg.sender)));
        if (digest.recover(sig) != msg.sender) revert BadSignature();
        uint96 amt = e.amount;
        e.amount = 0;
        // If AUSD is frozen/paused at this instant, safeTransfer reverts the
        // WHOLE transaction — atomicity rolls back `claimed`/`amount`, funds
        // stay in escrow, recipient retries after unpause (or sender cancels /
        // expiry reclaim). Nothing can strand; the UI must decode
        // AccountIsFrozen / paused-style reverts into a "try again shortly"
        // state instead of a generic error. (Task-302: add fork test.)
        ausd.safeTransfer(msg.sender, amt);
        emit Claimed(id, msg.sender, amt);
    }

    function cancel(uint256 id) external {
        Escrow storage e = escrows[id];
        if (e.sender != msg.sender) revert NotSender();
        if (e.claimed || e.amount == 0) revert AlreadyClaimed();
        e.claimed = true; // slot burned; funds out below
        uint96 amt = e.amount;
        e.amount = 0;
        ausd.safeTransfer(msg.sender, amt);
        emit Cancelled(id, msg.sender, amt);
    }

    /// @notice anyone may bounce expired funds back to the sender
    function reclaim(uint256 id) external {
        Escrow storage e = escrows[id];
        if (block.timestamp <= e.expiresAt) revert NotYetExpired();
        if (e.claimed || e.amount == 0) revert AlreadyClaimed();
        e.claimed = true;
        uint96 amt = e.amount;
        e.amount = 0;
        ausd.safeTransfer(e.sender, amt);
        emit Reclaimed(id, amt);
    }
}
