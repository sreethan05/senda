import { decodeEventLog, encodeFunctionData, parseAbiItem, type WalletClient } from "viem";
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

const escrowEventAbi = {
  Deposited: escrowAbi[1],
  Claimed: {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "amount", type: "uint96", indexed: false },
      { name: "relayer", type: "address", indexed: true },
    ],
  },
  Cancelled: {
    type: "event",
    name: "Cancelled",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "amount", type: "uint96", indexed: false },
    ],
  },
  Reclaimed: {
    type: "event",
    name: "Reclaimed",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
      { name: "amount", type: "uint96", indexed: false },
    ],
  },
} as const;

export interface DepositResult {
  escrowId: bigint;
  depositTxHash: `0x${string}`;
  expiresAt: bigint;
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
  let expiresAt = 0n;
  for (const log of depositReceipt.logs) {
    try {
      const events = decodeEventLog({
        abi: escrowAbi,
        data: log.data,
        topics: log.topics,
      });
      if (events.eventName === "Deposited") {
        escrowId = events.args.escrowId;
        expiresAt = events.args.expiresAt;
        break;
      }
    } catch {
      // not our event — skip
    }
  }
  if (escrowId === 0n) throw new Error("Deposit succeeded but escrow id was not found in events");

  return { escrowId, depositTxHash: depositHash, expiresAt };
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

/**
 * Terminal outcomes are NOT recoverable from the struct: claim(), cancel()
 * and reclaim() all set `claimed = true` and zero the amount, so storage
 * alone can't tell them apart (v1 mislabelled cancelled/reclaimed as
 * "claimed"). We read the emitted events instead. Null = getLogs unavailable
 * (range cap) — callers then fall back to the storage heuristic.
 */
export type TerminalOutcome = "claimed" | "cancelled" | "reclaimed";

const TERMINAL_EVENTS = [
  parseAbiItem(
    "event Claimed(uint256 indexed escrowId, address indexed payee, uint96 amount, address indexed relayer)",
  ),
  parseAbiItem("event Cancelled(uint256 indexed escrowId, address indexed sender, uint96 amount)"),
  parseAbiItem("event Reclaimed(uint256 indexed escrowId, uint96 amount)"),
] as const;

/** Log-range windows to try, widest first. A single wide window works on most
 * RPCs; the narrower fallbacks cover nodes that cap eth_getLogs ranges. */
async function logWindows(): Promise<Array<{ fromBlock: bigint; toBlock: bigint }>> {
  const latest = await getPublicClient().getBlockNumber();
  const at = (span: bigint) => (latest > span ? latest - span : 0n);
  return [
    { fromBlock: 0n, toBlock: latest },
    { fromBlock: at(1_000_000n), toBlock: latest },
    { fromBlock: at(100_000n), toBlock: latest },
  ];
}

function outcomeOf(eventName: string): TerminalOutcome | null {
  if (eventName === "Claimed") return "claimed";
  if (eventName === "Cancelled") return "cancelled";
  if (eventName === "Reclaimed") return "reclaimed";
  return null;
}

async function getTerminalOutcomeMap(): Promise<Map<string, TerminalOutcome> | null> {
  if (!config.escrowAddress) return null;
  const client = getPublicClient();
  for (const { fromBlock, toBlock } of await logWindows()) {
    try {
      const logs = await client.getLogs({
        address: config.escrowAddress,
        events: TERMINAL_EVENTS,
        fromBlock,
        toBlock,
      });
      const map = new Map<string, TerminalOutcome>();
      for (const log of logs) {
        const id = (log.args as unknown as { escrowId?: bigint }).escrowId;
        const outcome = outcomeOf(log.eventName);
        if (id !== undefined && outcome !== null) map.set(id.toString(), outcome);
      }
      return map;
    } catch {
      // range rejected — try a narrower window
    }
  }
  return null;
}

/** Single-escrow terminal outcome (claim page). null = pending OR unavailable. */
export async function getEscrowOutcome(id: bigint): Promise<TerminalOutcome | null> {
  const map = await getTerminalOutcomeMap();
  return map?.get(id.toString()) ?? null;
}

export interface MyEscrow {
  id: bigint;
  amount: bigint;
  /** Current terminal state, resolved from contract events and state. */
  status: "pending" | "claimed" | "cancelled" | "expired" | "refunded" | "complete";
  depositTxHash: `0x${string}` | null;
  expiresAt: bigint;
}

export interface MyEscrowPage {
  items: MyEscrow[];
  nextOffset: number | null;
}

/**
 * Use Supabase paging when available, otherwise use indexed logs from the
 * configured contract deployment block. For older local configurations that
 * omit the deployment block, retain a direct state-read fallback.
 */
export async function getMyEscrows(senderAddress: `0x${string}`, offset = 0): Promise<MyEscrowPage> {
  if (!config.escrowAddress) return { items: [], nextOffset: null };
  const stored = await readStoredEscrows(senderAddress, offset);
  if (stored !== null) return stored;
  const client = getPublicClient();
  if (config.escrowDeploymentBlock !== null) {
    const events = await readEscrowEvents(senderAddress, config.escrowDeploymentBlock);
    return { items: events, nextOffset: null };
  }
  const nextId = (await client.readContract({
    address: config.escrowAddress,
    abi: escrowReadAbi,
    functionName: "nextId",
  })) as bigint;
  const outcomes = await getTerminalOutcomeMap();

  const sender = senderAddress.toLowerCase();
  const out: MyEscrow[] = [];
  const now = BigInt(Math.floor(Date.now() / 1000));
  for (let id = 1n; id <= nextId; id++) {
    const e = (await client.readContract({
      address: config.escrowAddress,
      abi: escrowReadAbi,
      functionName: "escrows",
      args: [id],
    })) as readonly [`0x${string}`, bigint, `0x${string}`, bigint, boolean];
    const [escSender, amount, , expiresAt, claimed] = e;
    if (escSender.toLowerCase() !== sender) continue;
    const terminal = outcomes?.get(id.toString());
    const status: MyEscrow["status"] =
      terminal === "claimed"
        ? "claimed"
        : terminal === "cancelled"
          ? "cancelled"
          : terminal === "reclaimed"
            ? "refunded"
            : claimed || amount === 0n
              ? "complete" // storage alone can't identify the terminal action
              : expiresAt < now
                ? "expired"
                : "pending";
    out.push({ id, amount, status, depositTxHash: null, expiresAt });
  }
  return { items: out.sort((a, b) => (a.id < b.id ? 1 : -1)), nextOffset: null };
}

async function readEscrowEvents(senderAddress: `0x${string}`, fromBlock: bigint): Promise<MyEscrow[]> {
  if (!config.escrowAddress) return [];
  const client = getPublicClient();
  const depositedLogs = await client.getLogs({
    address: config.escrowAddress,
    event: escrowEventAbi.Deposited,
    args: { sender: senderAddress },
    fromBlock,
    toBlock: "latest",
  });
  const [claimedLogs, cancelledLogs, reclaimedLogs] = await Promise.all([
    client.getLogs({ address: config.escrowAddress, event: escrowEventAbi.Claimed, fromBlock, toBlock: "latest" }),
    client.getLogs({ address: config.escrowAddress, event: escrowEventAbi.Cancelled, fromBlock, toBlock: "latest" }),
    client.getLogs({ address: config.escrowAddress, event: escrowEventAbi.Reclaimed, fromBlock, toBlock: "latest" }),
  ]);
  const terminal = new Map<bigint, MyEscrow["status"]>();
  for (const log of claimedLogs) terminal.set(log.args.escrowId!, "claimed");
  for (const log of cancelledLogs) terminal.set(log.args.escrowId!, "cancelled");
  for (const log of reclaimedLogs) terminal.set(log.args.escrowId!, "refunded");
  const now = BigInt(Math.floor(Date.now() / 1000));
  return depositedLogs.map((log) => {
    const id = log.args.escrowId!;
    const expiresAt = log.args.expiresAt!;
    return {
      id,
      amount: log.args.amount!,
      status: terminal.get(id) ?? (expiresAt < now ? "expired" : "pending"),
      depositTxHash: log.transactionHash ?? null,
      expiresAt,
    };
  }).sort((a, b) => (a.id < b.id ? 1 : -1));
}

/** Use the server-side indexed history when configured; otherwise read the chain. */
async function readStoredEscrows(senderAddress: `0x${string}`, offset: number): Promise<MyEscrowPage | null> {
  const response = await fetch(`/api/claims?sender=${encodeURIComponent(senderAddress)}&offset=${offset}`);
  if (response.status === 503) return null;
  if (!response.ok) throw new Error("Couldn't load your transfers — try again.");
  const page = (await response.json()) as {
    items: Array<{ id: string; amount: string; status: MyEscrow["status"]; depositTxHash: `0x${string}` | null; expiresAt: string }>;
    hasMore: boolean;
  };
  return {
    items: page.items.map((row) => ({
      id: BigInt(row.id),
      amount: BigInt(row.amount),
      status: row.status,
      depositTxHash: row.depositTxHash,
      expiresAt: BigInt(row.expiresAt),
    })),
    nextOffset: page.hasMore ? offset + page.items.length : null,
  };
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
  const hash = await params.signer.sendTransaction({
    chain: config.chain,
    account,
    to: config.escrowAddress,
    data: cancelData,
    gas: await paddedGas({ account: account.address, to: config.escrowAddress, data: cancelData }),
  });
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Cancel failed on-chain — try again");
  await syncStoredStatus(params.id, hash);
  return hash;
}

/** Anyone may trigger the expired escrow's automatic return to its sender. */
export async function reclaimEscrow(params: {
  signer: WalletClient;
  id: bigint;
}): Promise<`0x${string}`> {
  if (!config.escrowAddress) throw new Error("Escrow not deployed");
  const account = params.signer.account;
  if (!account) throw new Error("Signer has no account attached");
  const reclaimAbi = [{
    type: "function",
    name: "reclaim",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  }] as const;
  const data = encodeFunctionData({ abi: reclaimAbi, functionName: "reclaim", args: [params.id] });
  const hash = await params.signer.sendTransaction({
    chain: config.chain,
    account,
    to: config.escrowAddress,
    data,
    gas: await paddedGas({ account: account.address, to: config.escrowAddress, data }),
  });
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Refund failed on-chain — try again");
  await syncStoredStatus(params.id, hash);
  return hash;
}

/** Wait until a relayed claim is confirmed before showing the recipient success. */
export async function waitForClaimConfirmation(id: bigint, hash: `0x${string}`): Promise<void> {
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Claim transaction failed — try again");
  await syncStoredStatus(id, hash);
}

async function syncStoredStatus(id: bigint, hash: `0x${string}`): Promise<void> {
  try {
    await fetch("/api/claims/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ escrowId: id.toString(), transactionHash: hash }),
    });
  } catch {
    // On-chain state is authoritative; a database sync can be retried separately.
  }
}
