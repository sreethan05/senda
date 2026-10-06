// SPDX-License-Identifier: MIT
// TASK-307 — issuer-compliance states (TEST_PLAN.md first-class states).
// AUSD is a LayerZero V2 OFT: per-account freezes + global pauses must revert
// ATOMICALLY (escrow stays pending, retry succeeds after unfreeze/unpause).
// Runs locally AND under --fork-url (mock-based, no chain dependence).
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20Mock} from "openzeppelin-contracts/mocks/token/ERC20Mock.sol";
import {SendEscrow} from "../src/SendEscrow.sol";

/// @dev ERC20 with issuer freezer + global pause (mirrors AUSD's OFT powers).
contract MockFreezableUSD is ERC20Mock {
    mapping(address => bool) public frozen;
    bool public paused;

    function setFrozen(address a, bool f) external {
        frozen[a] = f;
    }

    function setPaused(bool p) external {
        paused = p;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (paused) revert("paused");
        if (frozen[from] || frozen[to]) revert("frozen");
        super._update(from, to, value);
    }
}

contract SendEscrowComplianceTest is Test {
    MockFreezableUSD internal token;
    SendEscrow internal escrow;
    address internal sender;
    address internal payee;
    address internal relayer;
    uint256 internal constant LINK_PK = 0x111C;
    address internal linkKey;
    uint96 internal constant AMOUNT = 100_000_000;
    uint40 internal constant TTL = 10 minutes;

    uint256 internal constant SECP256K1_N =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
    bytes32 internal constant CLAIM_TYPEHASH = keccak256("Claim(uint256 escrowId,address payee)");

    function setUp() public {
        sender = makeAddr("sender");
        payee = makeAddr("payee");
        relayer = makeAddr("relayer");
        linkKey = vm.addr(LINK_PK);
        token = new MockFreezableUSD();
        escrow = new SendEscrow(address(token));
        token.mint(sender, 1_000_000_000_000);
    }

    function _claimSig(uint256 id, address p) internal view returns (bytes memory) {
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(LINK_PK, digest);
        if (uint256(s) > SECP256K1_N / 2) {
            s = bytes32(SECP256K1_N - uint256(s));
            v = v == 27 ? 28 : 27;
        }
        return abi.encodePacked(r, s, v);
    }

    function _deposit() internal returns (uint256 id) {
        vm.startPrank(sender);
        token.approve(address(escrow), AMOUNT);
        id = escrow.depositTo(linkKey, AMOUNT, TTL);
        vm.stopPrank();
    }

    function test_Deposit_RevertsWhenSenderFrozen() public {
        token.setFrozen(sender, true);
        vm.startPrank(sender);
        token.approve(address(escrow), AMOUNT);
        vm.expectRevert("frozen");
        escrow.depositTo(linkKey, AMOUNT, TTL);
        vm.stopPrank();
        // Atomic: no escrow recorded, id counter untouched.
        assertEq(escrow.nextId(), 0);
        token.setFrozen(sender, false);
        assertEq(_deposit(), 1);
    }

    function test_Claim_RevertsWhenPayeeFrozen_RetrySucceeds() public {
        uint256 id = _deposit();
        bytes memory sig = _claimSig(id, payee);
        token.setFrozen(payee, true);
        vm.prank(relayer);
        vm.expectRevert("frozen");
        escrow.claim(id, payee, sig);
        // Escrow still pending — nothing moved.
        (, uint96 a, , , bool c) = escrow.escrows(id);
        assertEq(a, AMOUNT);
        assertFalse(c);
        // Retry after unfreeze succeeds.
        token.setFrozen(payee, false);
        vm.prank(relayer);
        escrow.claim(id, payee, sig);
        assertEq(token.balanceOf(payee), AMOUNT);
    }

    function test_PausedBlocksFlows_RetrySucceeds() public {
        uint256 id = _deposit();
        bytes memory sig = _claimSig(id, payee);
        token.setPaused(true);
        vm.prank(relayer);
        vm.expectRevert("paused");
        escrow.claim(id, payee, sig);
        vm.prank(sender);
        vm.expectRevert("paused");
        escrow.cancel(id);
        token.setPaused(false);
        vm.prank(relayer);
        escrow.claim(id, payee, sig);
        assertEq(token.balanceOf(payee), AMOUNT);
    }
}
