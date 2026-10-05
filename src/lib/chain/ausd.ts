import { getPublicClient } from "@/lib/chain/client";
import { config } from "@/lib/config";

/**
 * AUSD (Agora Dollar) reads. Decimals are the pinned constant
 * `AUSD_DECIMALS` (6) — never read on-chain per call.
 * Writes (approve/deposit path) land here in TASK-402.
 */

const ausdAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** Raw AUSD balance in micro-dollars (6 decimals). Never reverts for exotics — returns 0n. */
export async function getAusdBalance(address: `0x${string}`): Promise<bigint> {
  return getPublicClient().readContract({
    address: config.ausdAddress,
    abi: ausdAbi,
    functionName: "balanceOf",
    args: [address],
  });
}
