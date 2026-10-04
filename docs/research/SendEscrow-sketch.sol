// SPDX-License-Identifier: MIT
// REFERENCE SKETCH — validated design from docs/research (RESEARCH_TECH.md §3).
// TASK-302 implements from this: expect adjustments while writing tests.
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {EIP712} from "openzeppelin-contracts/utils/EIP712.sol";
import {ECDSA} from "openzeppelin-contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/utils/cryptography/MessageHashUtils.sol";

contract SendEscrow is EIP712 {
    using ECDSA for bytes32;

    bytes32 private constant CLAIM_TYPEHASH =
        keccak256("Claim(uint256 escrowId,bytes32 codeHash,address payee)");

    struct Escrow {
        address sender;      // can cancel / reclaim target
        uint96 amount;       // AUSD, 6 decimals
        bytes32 phoneHash;   // keccak(phone ++ salt); salt never on-chain, lives in link (display only)
        bytes32 codeHash;    // keccak(abi.encodePacked(code)) — 6-digit claim code commitment
        uint64 expiresAt;    // unclaimed funds return via reclaim()
        bool claimed;
    }

    IERC20 public immutable ausd;
    uint256 public nextId;
    mapping(uint256 escrowId => Escrow) public escrows;

    error AlreadyClaimed();
    error NotSender();
    error Expired();
    error NotYetExpired();
    error BadCode();
    error BadSignature();

    constructor(address ausd_) EIP712("SendEscrow", "1") {
        ausd = IERC20(ausd_);
    }

    function depositTo(bytes32 phoneHash, bytes32 codeHash, uint96 amount, uint40 ttl)
        external
        returns (uint256 id)
    {
        id = ++nextId;
        escrows[id] = Escrow(
            msg.sender,
            amount,
            phoneHash,
            codeHash,
            uint64(block.timestamp) + ttl,
            false
        );
        ausd.transferFrom(msg.sender, address(this), amount); // interactions last (CEI)
    }

    function claim(uint256 id, string calldata code, bytes calldata sig) external {
        Escrow storage e = escrows[id];
        if (e.claimed || e.amount == 0) revert AlreadyClaimed();
        if (block.timestamp > e.expiresAt) revert Expired();
        bytes32 ch = keccak(abi.encodePacked(code));
        if (ch != e.codeHash) revert BadCode();
        // effects before interactions
        e.claimed = true;
        // sig from the claiming key over (escrowId, codeHash, payee=me):
        // binds the payee, making front-running fund-neutral (copied tx reverts BadSignature)
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, id, ch, msg.sender)));
        if (digest.recover(sig) != msg.sender) revert BadSignature();
        uint96 amt = e.amount;
        e.amount = 0;
        ausd.transfer(msg.sender, amt);
    }

    function cancel(uint256 id) external {
        Escrow storage e = escrows[id];
        if (e.sender != msg.sender) revert NotSender();
        if (e.claimed || e.amount == 0) revert AlreadyClaimed();
        e.claimed = true; // slot burned; funds out below
        uint96 amt = e.amount;
        e.amount = 0;
        ausd.transfer(msg.sender, amt);
    }

    /// @notice anyone may bounce expired funds back to the sender
    function reclaim(uint256 id) external {
        Escrow storage e = escrows[id];
        if (block.timestamp <= e.expiresAt) revert NotYetExpired();
        if (e.claimed || e.amount == 0) revert AlreadyClaimed();
        e.claimed = true;
        uint96 amt = e.amount;
        e.amount = 0;
        ausd.transfer(e.sender, amt);
    }
}
