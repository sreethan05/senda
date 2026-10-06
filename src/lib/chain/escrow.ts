import { decodeEventLog, encodeFunctionData, type WalletClient } from "viem";
import { config, explorerTxUrl } from "@/lib/config";
import { getPublicClient } from "@/lib/chain/client";

/**
 * Monad charges the DECLARED gas limit, not gas used — so estimates must be
 * generous enough to succeed but tight enough not to overpay. Estimate from
 * the RPC against the REAL AUSD proxy (its fallback-delegatecall path costs
 * more than mock-token measurements), then pad 20%.
 */
async function paddedGas(tx: {
  account: `0x${string}`;
  to: `0x${string}`;
  data: `0x${string}`;
}): Promise<bigint> {
  const estimated = await getPublicClient().estimateGas({
    account: tx.account,
    to: tx.to,
    data: tx.data,
  });
  return (estimated * 120n) / 100n;
}


/**
 * SendEscrow writes (TASK-402). All writes pass a tight EXPLICIT gas value —
 * Monad charges the declared gas limit, not gas used (RESEARCH_TECH §1).
 * Measured on the testnet suite: deposit ≈ 117.8k, approve ≈ 48k → padded.
 */

export const SEND_TTL_SECONDS = 60 * 60 * 24; // 24h default claim window

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
  const { signer, linkKeyAddress, amountMicroAusd } = params;
  if (!config.escrowAddress) {
    throw new Error("SendEscrow is not deployed on this network yet");
  }
  if (amountMicroAusd <= 0n) throw new Error("Amount must be greater than zero");
  // Use the client's LOCAL account (passkey session / burner). Passing a bare
  // address instead makes viem route to `wallet_sendTransaction`, which plain
  // HTTP transports don't support — the bug the first UI send hit.
  const account = signer.account;
  if (!account) throw new Error("Signer has no account attached");
  const accountAddress = account.address;

  // 1. approve — exact amount (AUSD has no increaseAllowance; exact-per-send avoids the race)
  const approveData = encodeFunctionData({
    abi: ausdAbi,
    functionName: "approve",
    args: [config.escrowAddress, amountMicroAusd],
  });
  const approveHash = await signer.sendTransaction({
    chain: config.chain,
    account,
    to: config.ausdAddress,
    data: approveData,
    gas: await paddedGas({ account: accountAddress, to: config.ausdAddress, data: approveData }),
  });
  const publicClient = (await import("@/lib/chain/client")).getPublicClient();
  const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
  if (approveReceipt.status !== "success") {
    throw new Error("Approval failed on-chain — try again");
  }

  // 2. depositTo
  const depositData = encodeFunctionData({
    abi: escrowAbi,
    functionName: "depositTo",
    args: [linkKeyAddress, amountMicroAusd, params.ttlSeconds ?? SEND_TTL_SECONDS],
  });
  const depositHash = await signer.sendTransaction({
    chain: config.chain,
    account,
    to: config.escrowAddress,
    data: depositData,
    gas: await paddedGas({ account: accountAddress, to: config.escrowAddress, data: depositData }),
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

/** Escrow read ABI (history + claim page). */
export const escrowReadAbi = [
  {
    type: "function",
    name: "escrows",
    stateMutability: "view",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [
      { name: "sender", type: "address" },
      { name: "amount", type: "uint96" },
      { name: "linkKey", type: "address" },
      { name: "expiresAt", type: "uint64" },
      { name: "claimed", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "nextId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export interface MyEscrow {
  id: bigint;
  amount: bigint;
  /** pending | claimed | cancelled | expired */
  status: "pending" | "claimed" | "cancelled" | "expired";
  depositTxHash: `0x${string}` | null;
  expiresAt: bigint;
}

/**
 * History reads: iterate escrow ids 1..nextId and filter by sender. Ids are
 * sequential and small in v1, which sidesteps public-RPC getLogs range caps
 * entirely. (The Deposited events exist for the Envio indexer when volume
 * outgrows this — see RESEARCH_SECURITY.md.)
 */
export async function getMyEscrows(senderAddress: `0x${string}`): Promise<MyEscrow[]> {
  if (!config.escrowAddress) return [];
  const client = getPublicClient();
  const nextId = (await client.readContract({
    address: config.escrowAddress,
    abi: escrowReadAbi,
    functionName: "nextId",
  })) as bigint;

  const sender = senderAddress.toLowerCase();
  const out: MyEscrow[] = [];
  for (let id = 1n; id <= nextId; id++) {
    const e = (await client.readContract({
      address: config.escrowAddress,
      abi: escrowReadAbi,
      functionName: "escrows",
      args: [id],
    })) as readonly [`0x${string}`, bigint, `0x${string}`, bigint, boolean];
    const [escSender, amount, , expiresAt, claimed] = e;
    if (escSender.toLowerCase() !== sender) continue;
    const now = BigInt(Math.floor(Date.now() / 1000));
    const status = claimed
      ? ("claimed" as const)
      : amount === 0n
        ? ("cancelled" as const)
        : expiresAt < now
          ? ("expired" as const)
          : ("pending" as const);
    out.push({ id, amount, status, depositTxHash: null, expiresAt });
  }
  return out.sort((a, b) => (a.id < b.id ? 1 : -1));
}

/** Sender-only refund (TASK-504). */
export async function cancelEscrow(params: {
  signer: WalletClient;
  senderAddress: `0x${string}`;
  id: bigint;
}): Promise<`0x${string}`> {
  if (!config.escrowAddress) throw new Error("Escrow not deployed");
  const account = params.signer.account;
  if (!account) throw new Error("Signer has no account attached");
  const cancelAbi = [
    {
      type: "function",
      name: "cancel",
      stateMutability: "nonpayable",
      inputs: [{ name: "id", type: "uint256" }],
      outputs: [],
    },
  ] as const;
  const cancelData = encodeFunctionData({ abi: cancelAbi, functionName: "cancel", args: [params.id] });
  return params.signer.sendTransaction({
    chain: config.chain,
    account,
    to: config.escrowAddress,
    data: cancelData,
    gas: await paddedGas({ account: account.address, to: config.escrowAddress, data: cancelData }),
  });
}
