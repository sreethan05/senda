import { NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, encodeFunctionData, http, recoverTypedDataAddress } from "viem";
import { config } from "@/lib/config";
import { getPublicClient } from "@/lib/chain/client";

/**
 * Relayer (ADR-013, sketch v3): submits `claim(id, payee, sig)` for a
 * recipient who holds zero MON.
 *
 * Security: the relayer receives ONLY (id, payee, sig) — never the link key —
 * and verifies the signature recovers to the ON-CHAIN link key for THIS escrow
 * before spending gas. It can censor/delay, never redirect; replaying observed
 * calldata pays the same payee. Holds gas MON, no user funds.
 */

const ESCROW_ABI = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "payee", type: "address" },
      { name: "sig", type: "bytes" },
    ],
  },
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

const CLAIM_TYPES = {
  Claim: [
    { name: "escrowId", type: "uint256" },
    { name: "payee", type: "address" },
  ],
} as const;

// Monad charges the declared gas limit — estimate from RPC against the real
// AUSD proxy + escrow, then pad 20% (hardcoded 200k underprovisions the proxy path).
async function paddedClaimGas(relayer: `0x${string}`, id: bigint, payee: `0x${string}`, sig: `0x${string}`): Promise<bigint> {
  const { encodeFunctionData } = await import("viem");
  const data = encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: "claim",
    args: [id, payee, sig],
  });
  const estimated = await getPublicClient().estimateGas({
    account: relayer,
    to: config.escrowAddress as `0x${string}`,
    data,
  });
  return (estimated * 120n) / 100n;
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (bucket === undefined || bucket.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

function relayer() {
  const key = process.env.RELAYER_KEY;
  if (key === undefined || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return privateKeyToAccount(key as `0x${string}`);
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests — try again in a minute." },
      { status: 429 },
    );
  }

  let body: { escrowId?: string; payee?: string; sig?: string; issuedAt?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request body" }, { status: 400 });
  }

  const { escrowId, payee, sig } = body;
  if (
    typeof escrowId !== "string" ||
    !/^\d+$/.test(escrowId) ||
    typeof payee !== "string" ||
    !/^0x[0-9a-fA-F]{40}$/.test(payee) ||
    typeof sig !== "string" ||
    !/^0x[0-9a-fA-F]{130}$/.test(sig)
  ) {
    return NextResponse.json({ error: "Invalid claim payload" }, { status: 400 });
  }
  if (
    typeof body.issuedAt === "number" &&
    Math.abs(Date.now() - body.issuedAt) > 10 * 60_000
  ) {
    return NextResponse.json(
      { error: "Claim request expired — reload the link" },
      { status: 400 },
    );
  }

  if (config.escrowAddress === undefined) {
    return NextResponse.json({ error: "Escrow not deployed on this network" }, { status: 503 });
  }
  const relayerAccount = relayer();
  if (relayerAccount === null) {
    return NextResponse.json(
      { error: "Relayer is not configured on this deployment" },
      { status: 503 },
    );
  }

  const id = BigInt(escrowId);
  const payeeAddr = payee as `0x${string}`;
  const publicClient = getPublicClient();

  // Read the escrow: existence, claimed, expiry — and the link key the sig
  // must recover to.
  const escrow = (await publicClient.readContract({
    address: config.escrowAddress,
    abi: ESCROW_ABI,
    functionName: "escrows",
    args: [id],
  })) as readonly [`0x${string}`, bigint, `0x${string}`, bigint, boolean];
  const [, , linkKey, expiresAt, claimed] = escrow;

  if (linkKey === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json({ error: "This escrow does not exist" }, { status: 404 });
  }
  if (claimed) {
    return NextResponse.json({ error: "Already claimed" }, { status: 409 });
  }
  if (expiresAt * 1000n < BigInt(Date.now())) {
    return NextResponse.json(
      { error: "This link has expired — the sender was refunded" },
      { status: 410 },
    );
  }

  // The signature must recover to the ON-CHAIN link key for THIS escrow —
  // this is what makes the relayer unable to redirect: it would have to forge
  // a signature from a key it has never seen.
  let signer: `0x${string}`;
  try {
    signer = await recoverTypedDataAddress({
      domain: {
        name: "SendEscrow",
        version: "1",
        chainId: config.chain.id,
        verifyingContract: config.escrowAddress,
      },
      types: CLAIM_TYPES,
      primaryType: "Claim",
      message: { escrowId: id, payee: payeeAddr },
      signature: sig as `0x${string}`,
    });
  } catch {
    return NextResponse.json({ error: "Invalid claim signature" }, { status: 400 });
  }
  if (signer.toLowerCase() !== linkKey.toLowerCase()) {
    return NextResponse.json({ error: "Invalid claim signature" }, { status: 400 });
  }

  const walletClient = createWalletClient({
    account: relayerAccount,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
  try {
    const hash = await walletClient.sendTransaction({
      chain: config.chain,
      account: relayerAccount,
      to: config.escrowAddress,
      data: encodeFunctionData({
        abi: ESCROW_ABI,
        functionName: "claim",
        args: [id, payeeAddr, sig as `0x${string}`],
      }),
      gas: await paddedClaimGas(relayerAccount.address, id, payeeAddr, sig as `0x${string}`),
    });
    return NextResponse.json({ ok: true, txHash: hash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "claim failed";
    if (/frozen|pause/i.test(msg)) {
      return NextResponse.json(
        { error: "The issuer temporarily paused transfers — try again shortly." },
        { status: 409 },
      );
    }
    if (/BadLinkKeySignature|AlreadyClaimed|Expired/i.test(msg)) {
      return NextResponse.json({ error: "This link can no longer be claimed" }, { status: 409 });
    }
    return NextResponse.json({ error: "Claim failed — try again" }, { status: 500 });
  }
}
