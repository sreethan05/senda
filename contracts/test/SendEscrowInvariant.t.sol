// SPDX-License-Identifier: MIT
// TASK-307 — handler-based invariants (RESEARCH_TECH.md §8):
// solvency (donation-safe >=), no-double-payout, sender-never-loses-more.
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20Mock} from "openzeppelin-contracts/mocks/token/ERC20Mock.sol";
import {SendEscrow} from "../src/SendEscrow.sol";

contract EscrowHandler is Test {
    SendEscrow public escrow;
    ERC20Mock public token;
    address public relayer;
    address[] public actors;
    uint256[] public linkPks; // linkPks[id - 1]

    uint256 public ghostDeposited;
    uint256 public ghostPaidOut;
    mapping(address => uint256) public ghostIn;
    mapping(address => uint256) public ghostOut;
    /// @dev refunds that flowed back to a sender (cancel/reclaim) — the only
    ///      outflow that can be a "loss" against that sender's own deposits.
    ///      Claim payouts go to PAYEES (other people's remittances) and are
    ///      conserved globally by invariant_NoDoublePayout, not per-sender.
    mapping(address => uint256) public ghostRefunds;

    uint256 internal constant SECP256K1_N =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
    bytes32 internal constant CLAIM_TYPEHASH = keccak256("Claim(uint256 escrowId,address payee)");

    constructor(SendEscrow e, ERC20Mock t, address r) {
        escrow = e;
        token = t;
        relayer = r;
        actors.push(makeAddr("actor0"));
        actors.push(makeAddr("actor1"));
        actors.push(makeAddr("actor2"));
        for (uint256 i = 0; i < actors.length; i++) {
            token.mint(actors[i], 1_000_000 ether);
        }
    }

    function _sig(uint256 pk, uint256 id, address p) internal view returns (bytes memory) {
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

    function deposit(uint96 amount, uint40 ttl, uint8 actorSeed, uint256 linkPk) external {
        amount = uint96(bound(amount, 1, 100_000 ether));
        ttl = uint40(bound(ttl, 10 minutes, 30 days));
        linkPk = bound(linkPk, 1, SECP256K1_N - 1);
        address actor = actors[actorSeed % actors.length];
        address linkKey = vm.addr(linkPk);
        vm.startPrank(actor);
        token.approve(address(escrow), amount);
        try escrow.depositTo(linkKey, amount, ttl) returns (uint256 id) {
            assertEq(id, linkPks.length + 1);
            linkPks.push(linkPk);
            ghostDeposited += amount;
            ghostIn[actor] += amount;
        } catch {}
        vm.stopPrank();
    }

    function claim(uint256 idSeed, uint8 payeeSeed, bool honest) external {
        uint256 next = escrow.nextId();
        if (next == 0) return;
        uint256 id = bound(idSeed, 1, next);
        address payee = actors[payeeSeed % actors.length];
        uint256 pk = honest ? linkPks[id - 1] : bound(idSeed ^ 0xBEEF, 1, SECP256K1_N - 1);
        if (!honest) vm.assume(pk != linkPks[id - 1]);
        (, uint96 amt, , , ) = escrow.escrows(id);
        vm.prank(relayer);
        try escrow.claim(id, payee, _sig(pk, id, payee)) {
            ghostPaidOut += amt;
            ghostOut[payee] += amt;
        } catch {}
    }

    function cancel(uint256 idSeed, uint8 actorSeed) external {
        uint256 next = escrow.nextId();
        if (next == 0) return;
        uint256 id = bound(idSeed, 1, next);
        address actor = actors[actorSeed % actors.length];
        (address s, uint96 amt, , , ) = escrow.escrows(id);
        vm.prank(actor);
        try escrow.cancel(id) {
            ghostPaidOut += amt;
            ghostOut[s] += amt;
            ghostRefunds[s] += amt;
        } catch {}
    }

    function reclaim(uint256 idSeed) external {
        uint256 next = escrow.nextId();
        if (next == 0) return;
        uint256 id = bound(idSeed, 1, next);
        (address s, uint96 amt, , , ) = escrow.escrows(id);
        try escrow.reclaim(id) {
            ghostPaidOut += amt;
            ghostOut[s] += amt;
            ghostRefunds[s] += amt;
        } catch {}
    }
}

contract SendEscrowInvariantTest is Test {
    ERC20Mock internal token;
    SendEscrow internal escrow;
    EscrowHandler internal handler;

    function setUp() public {
        token = new ERC20Mock();
        escrow = new SendEscrow(address(token));
        handler = new EscrowHandler(escrow, token, makeAddr("relayer"));
        targetContract(address(handler));
    }

    /// @dev Contract always holds AT LEAST the active total (>=: donations safe).
    function invariant_Solvency_BalanceGeActiveTotal() public view {
        uint256 active;
        uint256 next = escrow.nextId();
        for (uint256 id = 1; id <= next; id++) {
            (, uint96 amt, , , bool claimed) = escrow.escrows(id);
            if (!claimed) active += amt;
        }
        assertGe(token.balanceOf(address(escrow)), active);
    }

    /// @dev Never pays out more than was deposited (per-id state machine).
    function invariant_NoDoublePayout() public view {
        assertLe(handler.ghostPaidOut(), handler.ghostDeposited());
        uint256 next = escrow.nextId();
        for (uint256 id = 1; id <= next; id++) {
            (, uint96 amt, , , bool claimed) = escrow.escrows(id);
            if (claimed) assertEq(amt, 0);
        }
    }

    /// @dev No sender is refunded more than they deposited. (Claim payouts to
    ///      an actor in a PAYEE role are product flow — remittances received —
    ///      and are conserved globally by invariant_NoDoublePayout; counting
    ///      them as a per-sender "loss" was a handler modeling bug.)
    function invariant_SenderNeverRefundedMoreThanDeposited() public view {
        address[] memory actors = new address[](3);
        (actors[0], actors[1], actors[2]) = (handler.actors(0), handler.actors(1), handler.actors(2));
        for (uint256 i = 0; i < actors.length; i++) {
            assertLe(handler.ghostRefunds(actors[i]), handler.ghostIn(actors[i]));
        }
    }
}
