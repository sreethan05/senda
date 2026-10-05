// SPDX-License-Identifier: MIT
// TASK-303 — SendEscrow unit tests (TEST_PLAN.md "Contracts").
// Fuzz + invariants + fork + static analysis live in TASK-307.
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20Mock} from "openzeppelin-contracts/mocks/token/ERC20Mock.sol";
import {ECDSA} from "openzeppelin-contracts/utils/cryptography/ECDSA.sol";
import {IERC20Errors} from "openzeppelin-contracts/interfaces/draft-IERC6093.sol";
import {SendEscrow} from "../src/SendEscrow.sol";

/// @dev Reentrant ERC20: reenters escrow.claim once on the payout transfer.
/// Success = the outer claim reverts atomically and a retry still works —
/// reentrancy can never double-pay.
contract ReenteringToken is ERC20Mock {
    SendEscrow public target;
    uint256 public targetId;
    bool public armed;

    function arm(SendEscrow t, uint256 id) external {
        target = t;
        targetId = id;
        armed = true;
    }

    function disarm() external {
        armed = false;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (armed && from != address(0) && to != address(0)) {
            armed = false;
            target.claim(targetId, to, bytes(""));
        }
    }
}

contract SendEscrowTest is Test {
    // NOTE: ERC20Mock has 18 decimals vs AUSD's 6 — irrelevant here: the
    // escrow treats amounts as opaque uint96 integers.
    ERC20Mock internal token;
    SendEscrow internal escrow;

    address internal sender;
    address internal payee;
    address internal relayer;
    address internal attacker;
    uint256 internal constant LINK_PK = 0x111C;
    address internal linkKey;
    uint256 internal constant ATTACKER_PK = 0xA77AC4;
    uint96 internal constant AMOUNT = 100_000_000; // $100.00 at 6 decimals
    uint40 internal constant TTL = 10 minutes;

    uint256 internal constant SECP256K1_N =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
    bytes32 internal constant CLAIM_TYPEHASH = keccak256("Claim(uint256 escrowId,address payee)");

    function setUp() public {
        sender = makeAddr("sender");
        payee = makeAddr("payee");
        relayer = makeAddr("relayer");
        attacker = makeAddr("attacker");
        linkKey = vm.addr(LINK_PK);
        token = new ERC20Mock();
        escrow = new SendEscrow(address(token));
        token.mint(sender, 1_000_000_000_000);
    }

    // ---- helpers ----

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("SendEscrow")),
                keccak256(bytes("1")),
                block.chainid,
                address(escrow)
            )
        );
    }

    /// @dev Link-key EIP-712 signature over Claim(id, p), low-S normalized
    /// (OZ ECDSA rejects high-S — the Phase-5 frontend must normalize too).
    function _claimSig(uint256 pk, uint256 id, address p) internal view returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _domainSeparator(), keccak256(abi.encode(CLAIM_TYPEHASH, id, p)))
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        if (uint256(s) > SECP256K1_N / 2) {
            s = bytes32(SECP256K1_N - uint256(s));
            v = v == 27 ? 28 : 27;
        }
        return abi.encodePacked(r, s, v);
    }

    function _deposit(uint96 amount, uint40 ttl) internal returns (uint256 id) {
        vm.startPrank(sender);
        token.approve(address(escrow), amount);
        id = escrow.depositTo(linkKey, amount, ttl);
        vm.stopPrank();
    }

    // ---- deposit ----

    function test_Deposit_Happy() public {
        vm.startPrank(sender);
        token.approve(address(escrow), AMOUNT);
        uint64 expectedExpiry = uint64(block.timestamp) + TTL;
        vm.expectEmit(true, true, true, true);
        emit SendEscrow.Deposited(1, sender, linkKey, AMOUNT, expectedExpiry);
        uint256 id = escrow.depositTo(linkKey, AMOUNT, TTL);
        vm.stopPrank();

        assertEq(id, 1);
        (address s, uint96 a, address k, uint64 exp, bool c) = escrow.escrows(id);
        assertEq(s, sender);
        assertEq(a, AMOUNT);
        assertEq(k, linkKey);
        assertEq(exp, expectedExpiry);
        assertFalse(c);
        assertEq(token.balanceOf(address(escrow)), AMOUNT);
    }

    function test_Deposit_RevertsWhenZeroAmount() public {
        vm.startPrank(sender);
        token.approve(address(escrow), 1);
        vm.expectRevert(SendEscrow.BadAmount.selector);
        escrow.depositTo(linkKey, 0, TTL);
        vm.stopPrank();
    }

    function test_Deposit_RevertsWhenTtlTooShort() public {
        uint40 tooShort = escrow.MIN_TTL() - 1;
        vm.startPrank(sender);
        token.approve(address(escrow), AMOUNT);
        vm.expectRevert(SendEscrow.TtlTooShort.selector);
        escrow.depositTo(linkKey, AMOUNT, tooShort);
        vm.stopPrank();
    }

    function test_Deposit_RevertsWhenZeroLinkKey() public {
        vm.startPrank(sender);
        token.approve(address(escrow), AMOUNT);
        vm.expectRevert(SendEscrow.BadLinkKeySignature.selector);
        escrow.depositTo(address(0), AMOUNT, TTL);
        vm.stopPrank();
    }

    function test_Deposit_RevertsWhenNoAllowance() public {
        vm.prank(sender);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, address(escrow), 0, AMOUNT
            )
        );
        escrow.depositTo(linkKey, AMOUNT, TTL);
    }

    // ---- claim ----

    function test_Claim_Happy() public {
        uint256 id = _deposit(AMOUNT, TTL);
        vm.prank(relayer);
        vm.expectEmit(true, true, true, true);
        emit SendEscrow.Claimed(id, payee, AMOUNT, relayer);
        escrow.claim(id, payee, _claimSig(LINK_PK, id, payee));
        assertEq(token.balanceOf(payee), AMOUNT);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function test_Claim_RevertsWhenForgedSig() public {
        uint256 id = _deposit(AMOUNT, TTL);
        vm.prank(relayer);
        vm.expectRevert(SendEscrow.BadLinkKeySignature.selector);
        escrow.claim(id, payee, _claimSig(ATTACKER_PK, id, payee));
    }

    function test_Claim_RevertsWhenRelayerRedirects() public {
        uint256 id = _deposit(AMOUNT, TTL);
        // The v2 flaw shape: valid sig over (id, payee), submitted for attacker.
        bytes memory sig = _claimSig(LINK_PK, id, payee);
        vm.prank(relayer);
        vm.expectRevert(SendEscrow.BadLinkKeySignature.selector);
        escrow.claim(id, attacker, sig);
        // Funds untouched — the legitimate claim still works.
        vm.prank(relayer);
        escrow.claim(id, payee, sig);
        assertEq(token.balanceOf(payee), AMOUNT);
    }

    function test_Claim_RevertsWhenReplayedOnOtherEscrow() public {
        uint256 id1 = _deposit(AMOUNT, TTL);
        uint256 id2 = _deposit(AMOUNT, TTL);
        bytes memory sig1 = _claimSig(LINK_PK, id1, payee);
        vm.prank(relayer);
        vm.expectRevert(SendEscrow.BadLinkKeySignature.selector);
        escrow.claim(id2, payee, sig1);
    }

    function test_Claim_RevertsWhenDoubled() public {
        uint256 id = _deposit(AMOUNT, TTL);
        bytes memory sig = _claimSig(LINK_PK, id, payee);
        vm.prank(relayer);
        escrow.claim(id, payee, sig);
        vm.prank(relayer);
        vm.expectRevert(SendEscrow.AlreadyClaimed.selector);
        escrow.claim(id, payee, sig);
    }

    function test_Claim_RevertsWhenNoEscrow() public {
        vm.prank(relayer);
        vm.expectRevert(SendEscrow.NoEscrow.selector);
        escrow.claim(999, payee, bytes(""));
    }

    function test_Claim_RevertsWhenExpired() public {
        uint256 id = _deposit(AMOUNT, TTL);
        (, , , uint64 exp, ) = escrow.escrows(id);
        vm.warp(exp + 1);
        vm.prank(relayer);
        vm.expectRevert(SendEscrow.Expired.selector);
        escrow.claim(id, payee, _claimSig(LINK_PK, id, payee));
    }

    function test_Claim_SucceedsAtExactExpiry() public {
        uint256 id = _deposit(AMOUNT, TTL);
        (, , , uint64 exp, ) = escrow.escrows(id);
        vm.warp(exp); // boundary: claim at == expiresAt succeeds
        vm.prank(relayer);
        escrow.claim(id, payee, _claimSig(LINK_PK, id, payee));
        assertEq(token.balanceOf(payee), AMOUNT);
    }

    function test_Claim_RevertsWhenMalleatedSig() public {
        uint256 id = _deposit(AMOUNT, TTL);
        bytes memory low = _claimSig(LINK_PK, id, payee); // already low-S
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(low, 32))
            s := mload(add(low, 64))
            v := byte(0, mload(add(low, 96)))
        }
        // v-flip variant recovers to a different key.
        bytes memory vFlipped = abi.encodePacked(r, s, v == 27 ? 28 : 27);
        vm.prank(relayer);
        vm.expectRevert(SendEscrow.BadLinkKeySignature.selector);
        escrow.claim(id, payee, vFlipped);
        // high-S variant of the SAME sig — OZ ECDSA rejects outright.
        bytes32 highSVal = bytes32(SECP256K1_N - uint256(s));
        bytes memory highS = abi.encodePacked(r, highSVal, v == 27 ? 28 : 27);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureS.selector, highSVal));
        escrow.claim(id, payee, highS);
        // The untouched low-S original still works.
        vm.prank(relayer);
        escrow.claim(id, payee, low);
        assertEq(token.balanceOf(payee), AMOUNT);
    }

    // ---- cancel ----

    function test_Cancel_Happy() public {
        uint256 id = _deposit(AMOUNT, TTL);
        uint256 before = token.balanceOf(sender);
        vm.prank(sender);
        vm.expectEmit(true, true, false, true);
        emit SendEscrow.Cancelled(id, sender, AMOUNT);
        escrow.cancel(id);
        assertEq(token.balanceOf(sender), before + AMOUNT);
    }

    function test_Cancel_RevertsWhenNotSender() public {
        uint256 id = _deposit(AMOUNT, TTL);
        vm.prank(attacker);
        vm.expectRevert(SendEscrow.NotSender.selector);
        escrow.cancel(id);
    }

    function test_Cancel_RevertsWhenAfterClaim() public {
        uint256 id = _deposit(AMOUNT, TTL);
        bytes memory sig = _claimSig(LINK_PK, id, payee);
        vm.prank(relayer);
        escrow.claim(id, payee, sig);
        vm.prank(sender);
        vm.expectRevert(SendEscrow.AlreadyClaimed.selector);
        escrow.cancel(id);
    }

    function test_Cancel_RevertsWhenNoEscrow() public {
        vm.prank(sender);
        vm.expectRevert(SendEscrow.NoEscrow.selector);
        escrow.cancel(999);
    }

    // ---- reclaim ----

    function test_Reclaim_Happy() public {
        uint256 id = _deposit(AMOUNT, TTL);
        (, , , uint64 exp, ) = escrow.escrows(id);
        vm.warp(exp + 1);
        uint256 before = token.balanceOf(sender);
        vm.expectEmit(true, false, false, true);
        emit SendEscrow.Reclaimed(id, AMOUNT);
        escrow.reclaim(id);
        assertEq(token.balanceOf(sender), before + AMOUNT);
    }

    function test_Reclaim_RevertsWhenNotYetExpired() public {
        uint256 id = _deposit(AMOUNT, TTL);
        (, , , uint64 exp, ) = escrow.escrows(id);
        vm.warp(exp); // boundary: at == expiresAt, reclaim NOT yet allowed
        vm.expectRevert(SendEscrow.NotYetExpired.selector);
        escrow.reclaim(id);
    }

    function test_Reclaim_RevertsWhenTwice() public {
        uint256 id = _deposit(AMOUNT, TTL);
        (, , , uint64 exp, ) = escrow.escrows(id);
        vm.warp(exp + 1);
        escrow.reclaim(id);
        vm.expectRevert(SendEscrow.AlreadyClaimed.selector);
        escrow.reclaim(id);
    }

    // ---- reentrancy ----

    function test_Claim_SurvivesReentrantToken() public {
        ReenteringToken rtoken = new ReenteringToken();
        SendEscrow rescrow = new SendEscrow(address(rtoken));
        rtoken.mint(sender, AMOUNT);
        vm.startPrank(sender);
        rtoken.approve(address(rescrow), AMOUNT);
        uint256 id = rescrow.depositTo(linkKey, AMOUNT, TTL);
        vm.stopPrank();

        rtoken.arm(rescrow, id);
        bytes memory sig = _claimSigFor(address(rescrow), LINK_PK, id, payee);
        vm.prank(relayer);
        vm.expectRevert(SendEscrow.AlreadyClaimed.selector);
        rescrow.claim(id, payee, sig);

        // Escrow intact — a clean retry pays exactly once.
        rtoken.disarm();
        vm.prank(relayer);
        rescrow.claim(id, payee, sig);
        assertEq(rtoken.balanceOf(payee), AMOUNT);
        assertEq(rtoken.balanceOf(address(rescrow)), 0);
    }

    function _claimSigFor(address escr, uint256 pk, uint256 id, address p)
        internal
        view
        returns (bytes memory)
    {
        bytes32 sep = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("SendEscrow")),
                keccak256(bytes("1")),
                block.chainid,
                escr
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", sep, keccak256(abi.encode(CLAIM_TYPEHASH, id, p)))
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        if (uint256(s) > SECP256K1_N / 2) {
            s = bytes32(SECP256K1_N - uint256(s));
            v = v == 27 ? 28 : 27;
        }
        return abi.encodePacked(r, s, v);
    }
}
