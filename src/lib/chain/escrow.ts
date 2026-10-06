import { decodeEventLog, encodeFunctionData, type WalletClient } from "viem";
import { config, explorerTxUrl } from "@/lib/config";


/**
 * SendEscrow writes (TASK-402). All writes pass a tight EXPLICIT gas value —
 * Monad charges the declared gas limit, not gas used (RESEARCH_TECH §1).
 * Measured on the testnet suite: deposit ≈ 117.8k, approve ≈ 48k → padded.
 */

export const SEND_TTL_SECONDS = 60 * 60 * 24; // 24h default claim window
export const GAS_APPROVE = 60_000n;
export const GAS_DEPOSIT = 150_000n;

const ausdAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const escrowAbi = [
  {
    type: "function",
    name: "depositTo",
    stateMutability: "nonpayable",
    inputs: [
      { name: "linkKey", type: "address" },
      { name: "amount", type: "uint96" },
      { name: "ttl", type: "uint40" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "linkKey", type: "address", indexed: true },
      { name: "amount", type: "uint96", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false },
    ],
  },
] as const;

export interface DepositResult {
  escrowId: bigint;
  depositTxHash: `0x${string}`;
}

/**
 * approve(escrow, amount) → depositTo(linkKey, amount, ttl). Two transactions
 * from the sender's passkey/burner wallet. Amount is uint96 micro-AUSD.
 */
export async function approveAndDeposit(params: {
  signer: WalletClient;
  senderAddress: `0x${string}`;
  linkKeyAddress: `0x${string}`;
  amountMicroAusd: bigint;
  ttlSeconds?: number;
}): Promise<DepositResult> {
  const { signer, senderAddress, linkKeyAddress, amountMicroAusd } = params;
  if (!config.escrowAddress) {
    throw new Error("SendEscrow is not deployed on this network yet");
  }
  if (amountMicroAusd <= 0n) throw new Error("Amount must be greater than zero");

  // 1. approve — exact amount (AUSD has no increaseAllowance; exact-per-send avoids the race)
  const approveHash = await signer.sendTransaction({
    chain: config.chain,
    account: senderAddress,
    to: config.ausdAddress,
    data: encodeFunctionData({
      abi: ausdAbi,
      functionName: "approve",
      args: [config.escrowAddress, amountMicroAusd],
    }),
    gas: GAS_APPROVE,
  });
  const publicClient = (await import("@/lib/chain/client")).getPublicClient();
  const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
  if (approveReceipt.status !== "success") {
    throw new Error("Approval failed on-chain — try again");
  }

  // 2. depositTo
  const depositHash = await signer.sendTransaction({
    chain: config.chain,
    account: senderAddress,
    to: config.escrowAddress,
    data: encodeFunctionData({
      abi: escrowAbi,
      functionName: "depositTo",
      args: [
        linkKeyAddress,
        amountMicroAusd,
        params.ttlSeconds ?? SEND_TTL_SECONDS,
      ],
    }),
    gas: GAS_DEPOSIT,
  });
  const depositReceipt = await publicClient.waitForTransactionReceipt({
    hash: depositHash,
  });
  if (depositReceipt.status !== "success") {
    throw new Error("Deposit failed on-chain — funds were NOT moved (approval already returned)");
  }

  // 3. recover escrowId from the Deposited event
  let escrowId = 0n;
  for (const log of depositReceipt.logs) {
    try {
      const events = decodeEventLog({
        abi: escrowAbi,
        data: log.data,
        topics: log.topics,
      });
      if (events.eventName === "Deposited") {
        escrowId = events.args.escrowId;
        break;
      }
    } catch {
      // not our event — skip
    }
  }
  if (escrowId === 0n) throw new Error("Deposit succeeded but escrow id was not found in events");

  return { escrowId, depositTxHash: depositHash };
}

export { explorerTxUrl };
