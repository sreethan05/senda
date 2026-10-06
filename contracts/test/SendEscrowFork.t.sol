// SPDX-License-Identifier: MIT
// TASK-307 — testnet-fork tests (live AUSD on 10143).
// Run: forge test --match-contract SendEscrowForkTest --fork-url https://testnet-rpc.monad.xyz
// No keystore, no funds needed: the faucet is permissionless and fork state
// is local. Not pinned to a block (faucet callable anytime).
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SendEscrow} from "../src/SendEscrow.sol";

interface ILiveAusd {
    function decimals() external view returns (uint8);
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

interface ILiveFaucet {
    function requestFunds(address) external;
}

contract SendEscrowForkTest is Test {
    address internal constant AUSD_TESTNET = 0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC;
    address internal constant FAUCET = 0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C;
    uint256 internal constant LINK_PK = 0x111C;

    uint256 internal constant SECP256K1_N =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
    bytes32 internal constant CLAIM_TYPEHASH = keccak256("Claim(uint256 escrowId,address payee)");

    function _sig(SendEscrow escrow, uint256 id, address p) internal view returns (bytes memory) {
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

    function test_Fork_LiveAusdIs6Decimals_AndFaucetMints10k() public {
        vm.skip(block.chainid != 10143, "testnet fork only");
        assertEq(ILiveAusd(AUSD_TESTNET).decimals(), 6);
        address payee = makeAddr("fork-payee");
        ILiveFaucet(FAUCET).requestFunds(payee);
        assertEq(ILiveAusd(AUSD_TESTNET).balanceOf(payee), 10_000_000_000);
    }

    function test_Fork_DepositClaimWithLiveAusd() public {
        vm.skip(block.chainid != 10143, "testnet fork only");
        address sender = makeAddr("fork-sender");
        address payee = makeAddr("fork-payee");
        address relayer = makeAddr("fork-relayer");
        address linkKey = vm.addr(LINK_PK);

        ILiveFaucet(FAUCET).requestFunds(sender);
        SendEscrow escrow = new SendEscrow(AUSD_TESTNET);

        vm.startPrank(sender);
        ILiveAusd(AUSD_TESTNET).approve(address(escrow), 1_000_000_000);
        uint256 id = escrow.depositTo(linkKey, 1_000_000_000, 10 minutes);
        vm.stopPrank();

        vm.prank(relayer);
        escrow.claim(id, payee, _sig(escrow, id, payee));
        assertEq(ILiveAusd(AUSD_TESTNET).balanceOf(payee), 1_000_000_000);
    }
}
