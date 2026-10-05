import type { Hash, WalletClient } from "viem";
import { getPublicClient } from "@/lib/chain/client";
import { config } from "@/lib/config";

/**
 * Testnet AUSD faucet. Mints 10,000 AUSD to the recipient — testnet ONLY
 * (the button never renders on mainnet). The caller still needs a little
 * testnet MON for the network fee (faucet.monad.xyz).
 */

export const FAUCET_ADDRESS = "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C" as const;

/** 10,000 AUSD in micro-dollars. */
export const FAUCET_MINT_AMOUNT = 10_000_000_000n;

const faucetAbi = [
  {
    type: "function",
    name: "requestFunds",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [],
  },
] as const;

export function isFaucetAvailable(): boolean {
  return config.isTestnet;
}

/**
 * Submits requestFunds(recipient). Gas is estimated from the RPC and passed
 * explicitly — Monad charges the DECLARED limit, never a bumped fallback.
 */
export async function requestTestFunds(
  client: WalletClient,
  recipient: `0x${string}`,
): Promise<Hash> {
  if (!config.isTestnet) {
    throw new Error("Test money is only available on the test network.");
  }
  const sender = client.account?.address;
  if (sender === undefined) throw new Error("Wallet has no account attached.");
  const gas = await getPublicClient().estimateContractGas({
    address: FAUCET_ADDRESS,
    abi: faucetAbi,
    functionName: "requestFunds",
    args: [recipient],
    account: sender,
  });
  return client.writeContract({
    address: FAUCET_ADDRESS,
    abi: faucetAbi,
    functionName: "requestFunds",
    args: [recipient],
    chain: config.chain,
    account: sender,
    gas,
  });
}
