// SPDX-License-Identifier: MIT
// TASK-304/305 — deploys SendEscrow against the AUSD of the active chain.
// Testnet-first: default profile targets 10143; mainnet via --profile mainnet.
// Broadcast (needs the `monad-deployer` keystore + gas — see commands below):
//   cast wallet import monad-deployer            # interactive, ONCE (prompts, never on CLI)
//   forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
//   forge script script/Deploy.s.sol --rpc-url monad --profile mainnet --broadcast
// Verify (no API key):
//   forge verify-contract <ADDR> src/SendEscrow.sol:SendEscrow --chain 10143 \
//     --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {SendEscrow} from "../src/SendEscrow.sol";

contract Deploy is Script {
    address internal constant AUSD_TESTNET = 0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC;
    address internal constant AUSD_MAINNET = 0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a;

    function run() external returns (SendEscrow escrow) {
        address ausd;
        if (block.chainid == 143) {
            ausd = AUSD_MAINNET;
        } else if (block.chainid == 10143) {
            ausd = AUSD_TESTNET;
        } else {
            revert("Deploy: unknown chain - use 10143 or 143");
        }
        vm.startBroadcast();
        escrow = new SendEscrow(ausd);
        vm.stopBroadcast();
        console.log("chain:", block.chainid);
        console.log("ausd:", ausd);
        console.log("escrow:", address(escrow));
    }
}
