import { NextResponse } from "next/server";
import { decodeEventLog } from "viem";
import { config } from "@/lib/config";
import { getPublicClient } from "@/lib/chain/client";
import { getSupabaseConfig, supabaseRequest } from "@/lib/server/supabase";

const TERMINAL_EVENTS = [
  { type: "event", name: "Claimed", inputs: [
    { name: "escrowId", type: "uint256", indexed: true }, { name: "payee", type: "address", indexed: true },
    { name: "amount", type: "uint96", indexed: false }, { name: "relayer", type: "address", indexed: true },
  ] },
  { type: "event", name: "Cancelled", inputs: [
    { name: "escrowId", type: "uint256", indexed: true }, { name: "sender", type: "address", indexed: true },
    { name: "amount", type: "uint96", indexed: false },
  ] },
  { type: "event", name: "Reclaimed", inputs: [
    { name: "escrowId", type: "uint256", indexed: true }, { name: "amount", type: "uint96", indexed: false },
  ] },
] as const;

export async function POST(request: Request) {
  if (!getSupabaseConfig()) return NextResponse.json({ configured: false });
  if (!config.escrowAddress) return NextResponse.json({ error: "Escrow is not configured" }, { status: 503 });
  let body: { escrowId?: string; transactionHash?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request body" }, { status: 400 });
  }
  if (
    typeof body.escrowId !== "string" || !/^\d{1,78}$/.test(body.escrowId) ||
    typeof body.transactionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(body.transactionHash)
  ) return NextResponse.json({ error: "Invalid status update" }, { status: 400 });

  try {
    const client = getPublicClient();
    const receipt = await client.getTransactionReceipt({ hash: body.transactionHash as `0x${string}` });
    if (receipt.status !== "success" || receipt.to?.toLowerCase() !== config.escrowAddress.toLowerCase()) {
      return NextResponse.json({ error: "Transaction could not be verified" }, { status: 400 });
    }
    let nextStatus: "claimed" | "cancelled" | "refunded" | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== config.escrowAddress.toLowerCase()) continue;
      try {
        const event = decodeEventLog({ abi: TERMINAL_EVENTS, data: log.data, topics: log.topics });
        if (event.args.escrowId === BigInt(body.escrowId)) {
          nextStatus = event.eventName === "Claimed" ? "claimed" : event.eventName === "Cancelled" ? "cancelled" : "refunded";
          break;
        }
      } catch {
        // Ignore logs emitted by other contracts in the same transaction.
      }
    }
    if (nextStatus === null) return NextResponse.json({ error: "Transaction did not settle this escrow" }, { status: 400 });
    const query = new URLSearchParams({ escrow_id: `eq.${body.escrowId}` });
    await supabaseRequest<undefined>(`claims?${query}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: nextStatus, settled_at: new Date().toISOString() }),
    });
    return NextResponse.json({ ok: true, status: nextStatus });
  } catch {
    return NextResponse.json({ error: "Couldn't update transfer history" }, { status: 502 });
  }
}
