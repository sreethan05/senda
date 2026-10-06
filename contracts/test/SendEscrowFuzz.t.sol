// SPDX-License-Identifier: MIT
// TASK-307 — fuzz suite (TEST_PLAN.md "Contracts", RESEARCH_TECH.md §8).
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20Mock} from "openzeppelin-contracts/mocks/token/ERC20Mock.sol";
import {SendEscrow} from "../src/SendEscrow.sol";

contract SendEscrowFuzzTest is Test {
    ERC20Mock internal token;
    SendEscrow internal escrow;
    address internal sender;
    address internal relayer;
    uint256 internal constant LINK_PK = 0x111C;

    uint256 internal constant SECP256K1_N =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
    bytes32 internal constant CLAIM_TYPEHASH = keccak256("Claim(uint256 escrowId,address payee)");

    function setUp() public {
        sender = makeAddr("sender");
        relayer = makeAddr("relayer");
        token = new ERC20Mock();
        escrow = new SendEscrow(address(token));
        token.mint(sender, type(uint256).max / 2);
    }

    function _claimSig(uint256 pk, uint256 id, address p) internal view returns (bytes memory) {
        bytes32 sep = keccak256(
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
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", sep, keccak256(abi.encode(CLAIM_TYPEHASH, id, p))));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        if (uint256(s) > SECP256K1_N / 2) {
            s = bytes32(SECP256K1_N - uint256(s));
            v = v == 27 ? 28 : 27;
        }
        return abi.encodePacked(r, s, v);
    }

    /// @dev Any deposit → claim round-trips the exact amount.
    function testFuzz_DepositClaim_RoundTrip(uint96 amount, uint40 ttl, uint256 linkPk, uint256 payeeSeed)
        public
    {
        amount = uint96(bound(amount, 1, 1_000_000 ether));
        ttl = uint40(bound(ttl, escrow.MIN_TTL(), 365 days));
        linkPk = bound(linkPk, 1, SECP256K1_N - 1);
        address linkKey = vm.addr(linkPk);
        address payee = address(uint160(bound(payeeSeed, 1, type(uint160).max)));

        vm.startPrank(sender);
        token.approve(address(escrow), amount);
        uint256 id = escrow.depositTo(linkKey, amount, ttl);
        vm.stopPrank();

        uint256 before = token.balanceOf(payee);
        vm.prank(relayer);
        escrow.claim(id, payee, _claimSig(linkPk, id, payee));
        assertEq(token.balanceOf(payee) - before, amount);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    /// @dev No signature from any other key can ever authorize a claim.
    function testFuzz_NoClaimWithoutValidSig(uint256 attackerPk, uint256 payeeSeed) public {
        attackerPk = bound(attackerPk, 1, SECP256K1_N - 1);
        vm.assume(attackerPk != LINK_PK);
        address linkKey = vm.addr(LINK_PK);
        address payee = address(uint160(bound(payeeSeed, 1, type(uint160).max)));

        vm.startPrank(sender);
        token.approve(address(escrow), 1_000_000);
        uint256 id = escrow.depositTo(linkKey, 1_000_000, escrow.MIN_TTL());
        vm.stopPrank();

        vm.prank(relayer);
        vm.expectRevert(SendEscrow.BadLinkKeySignature.selector);
        escrow.claim(id, payee, _claimSig(attackerPk, id, payee));
    }

    /// @dev A signature over one payee never pays a different one.
    function testFuzz_WrongPayeeNeverClaims(uint256 payeeSeed, uint256 otherSeed) public {
        address payee = address(uint160(bound(payeeSeed, 1, type(uint160).max)));
        address other = address(uint160(bound(otherSeed, 1, type(uint160).max)));
        vm.assume(other != payee);
        address linkKey = vm.addr(LINK_PK);

        vm.startPrank(sender);
        token.approve(address(escrow), 1_000_000);
        uint256 id = escrow.depositTo(linkKey, 1_000_000, escrow.MIN_TTL());
        vm.stopPrank();

        bytes memory sig = _claimSig(LINK_PK, id, payee);
        vm.prank(relayer);
        vm.expectRevert(SendEscrow.BadLinkKeySignature.selector);
        escrow.claim(id, other, sig);
    }
}
