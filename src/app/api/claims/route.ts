import { NextResponse } from "next/server";
import { isAddress, recoverTypedDataAddress } from "viem";
import { config } from "@/lib/config";
import { getPublicClient } from "@/lib/chain/client";
import { getSupabaseConfig, supabaseRequest } from "@/lib/server/supabase";

const ESCROW_ABI = [
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
] as const;

interface ClaimRow {
  escrow_id: string;
  amount: string;
  status: "pending" | "claimed" | "cancelled" | "refunded";
  deposit_tx_hash: string | null;
  expires_at: string;
  created_at: string;
}

function unavailable() {
  return NextResponse.json({ error: "History storage is not configured" }, { status: 503 });
}

export async function GET(request: Request) {
  if (!getSupabaseConfig()) return unavailable();
  const sender = new URL(request.url).searchParams.get("sender");
  const offsetRaw = new URL(request.url).searchParams.get("offset") ?? "0";
  if (!sender || !isAddress(sender) || !/^\d{1,8}$/.test(offsetRaw)) {
    return NextResponse.json({ error: "Invalid history query" }, { status: 400 });
  }
  const offset = Number(offsetRaw);
  const pageSize = 50;
  const query = new URLSearchParams({
    select: "escrow_id,amount,status,deposit_tx_hash,expires_at,created_at",
    sender_address: `eq.${sender.toLowerCase()}`,
    order: "created_at.desc",
    limit: String(pageSize),
    offset: String(offset),
  });
  try {
    const rows = await supabaseRequest<ClaimRow[]>(`claims?${query.toString()}`);
    const now = Math.floor(Date.now() / 1000);
    const items = rows.map((row) => ({
      id: row.escrow_id,
      amount: row.amount,
      status: row.status === "pending" && Number(row.expires_at) < now ? "expired" : row.status,
      depositTxHash: row.deposit_tx_hash,
      expiresAt: row.expires_at,
    }));
    return NextResponse.json({ items, hasMore: rows.length === pageSize });
  } catch {
    return NextResponse.json({ error: "Couldn't load transfer history" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!getSupabaseConfig()) return unavailable();
  let body: {
    escrowId?: string;
    sender?: string;
    amount?: string;
    linkKeyAddress?: string;
    keyHash?: string;
    depositTxHash?: string;
    expiresAt?: string;
    senderProof?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request body" }, { status: 400 });
  }
  if (
    typeof body.escrowId !== "string" || !/^\d{1,78}$/.test(body.escrowId) ||
    typeof body.sender !== "string" || !isAddress(body.sender) ||
    typeof body.amount !== "string" || !/^\d{1,29}$/.test(body.amount) || BigInt(body.amount) <= 0n ||
    typeof body.linkKeyAddress !== "string" || !isAddress(body.linkKeyAddress) ||
    typeof body.keyHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(body.keyHash) ||
    typeof body.depositTxHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(body.depositTxHash) ||
    typeof body.expiresAt !== "string" || !/^\d{1,12}$/.test(body.expiresAt) ||
    typeof body.senderProof !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(body.senderProof)
  ) {
    return NextResponse.json({ error: "Invalid history record" }, { status: 400 });
  }
  if (!config.escrowAddress) return NextResponse.json({ error: "Escrow is not configured" }, { status: 503 });

  try {
    const proofSigner = await recoverTypedDataAddress({
      domain: {
        name: "senda history",
        version: "1",
        chainId: config.chain.id,
        verifyingContract: config.escrowAddress,
      },
      types: {
        HistoryRecord: [
          { name: "escrowId", type: "uint256" },
          { name: "amount", type: "uint96" },
          { name: "linkKeyAddress", type: "address" },
          { name: "keyHash", type: "bytes32" },
          { name: "depositTxHash", type: "bytes32" },
          { name: "expiresAt", type: "uint64" },
        ],
      },
      primaryType: "HistoryRecord",
      message: {
        escrowId: BigInt(body.escrowId),
        amount: BigInt(body.amount),
        linkKeyAddress: body.linkKeyAddress as `0x${string}`,
        keyHash: body.keyHash as `0x${string}`,
        depositTxHash: body.depositTxHash as `0x${string}`,
        expiresAt: BigInt(body.expiresAt),
      },
      signature: body.senderProof as `0x${string}`,
    });
    if (proofSigner.toLowerCase() !== body.sender.toLowerCase()) {
      return NextResponse.json({ error: "History record was not authorized by its sender" }, { status: 403 });
    }
    const publicClient = getPublicClient();
    const receipt = await publicClient.getTransactionReceipt({ hash: body.depositTxHash as `0x${string}` });
    if (receipt.status !== "success" || receipt.to?.toLowerCase() !== config.escrowAddress.toLowerCase()) {
      return NextResponse.json({ error: "Deposit transaction could not be verified" }, { status: 400 });
    }
    const state = await publicClient.readContract({
      address: config.escrowAddress,
      abi: ESCROW_ABI,
      functionName: "escrows",
      args: [BigInt(body.escrowId)],
    });
    const [onchainSender, onchainAmount, onchainLinkKey, onchainExpiry] = state;
    if (
      onchainSender.toLowerCase() !== body.sender.toLowerCase() ||
      onchainAmount !== BigInt(body.amount) ||
      onchainLinkKey.toLowerCase() !== body.linkKeyAddress.toLowerCase() ||
      onchainExpiry !== BigInt(body.expiresAt)
    ) {
      return NextResponse.json({ error: "History record does not match the escrow" }, { status: 400 });
    }
    const query = new URLSearchParams({ on_conflict: "escrow_id" });
    await supabaseRequest<undefined>(`claims?${query}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        escrow_id: body.escrowId,
        key_hash: body.keyHash.toLowerCase(),
        amount: body.amount,
        status: "pending",
        sender_address: body.sender.toLowerCase(),
        deposit_tx_hash: body.depositTxHash.toLowerCase(),
        expires_at: body.expiresAt,
      }),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't save transfer history" }, { status: 502 });
  }
}
