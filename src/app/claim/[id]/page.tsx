"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Fingerprint, LoaderCircle, ShieldCheck } from "lucide-react";
import { formatUsd } from "@/lib/format";
import { config } from "@/lib/config";
import { getPublicClient } from "@/lib/chain/client";
import { signClaimAuthorization } from "@/lib/chain/linkKey";
import { getEscrowOutcome } from "@/lib/chain/escrow";
import { BankPayout } from "@/features/claim/BankPayout";

/**
 * Claim page (TASK-501/502/503): opens from a shared link whose FRAGMENT
 * carries the ephemeral link key's private half (#k=...). The fragment is
 * never sent to any server. Flow: read link key → read escrow on-chain →
 * Mera passkey creates the recipient's account (payee) → the LINK KEY signs
 * the Claim authorization (client-side, no gas) → senda's relayer submits
 * the claim → receipt. See RESEARCH_TECH.md §3.
 */

type Phase =
  | "loading"
  | "badLink"
  | "noEscrow"
  | "claimed"
  | "cancelled"
  | "expired"
  | "ready"
  | "busy"
  | "done"
  | "error";

interface EscrowView {
  sender: `0x${string}`;
  amount: bigint;
  expiresAt: bigint;
  claimed: boolean;
}

function shortSender(a: string): string {
  return `0x••••${a.slice(-4)}`;
}

export default function ClaimPage() {
  const params = useMemo(() => {
    if (typeof window === "undefined") return null;
    return { id: window.location.pathname.split("/").pop() ?? "", hash: window.location.hash };
  }, []);

  const [phase, setPhase] = useState<Phase>("loading");
  const [escrow, setEscrow] = useState<EscrowView | null>(null);
  const [busyText, setBusyText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ seconds: number; txHash: string } | null>(null);
  const [balanceAfter, setBalanceAfter] = useState<string | null>(null);
  const [showPayout, setShowPayout] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- link-key + on-chain read on mount, race-guarded */
  useEffect(() => {
    if (params === null) return;
    const idRaw = params.id;
    let keyHex: string | null = null;
    const m = /#k=([0-9a-fA-F]{64})/.exec(params.hash);
    if (m !== null) keyHex = m[1];

    if (!/^\d+$/.test(idRaw) || keyHex === null) {
      setPhase("badLink");
      return;
    }
    if (config.escrowAddress === undefined) {
      setPhase("error");
      setError("The escrow contract isn't deployed on this network yet.");
      return;
    }
    const id = BigInt(idRaw);
    getPublicClient()
      .readContract({
        address: config.escrowAddress,
        abi: ESCROWS_ABI,
        functionName: "escrows",
        args: [id],
      })
      .then(async (r) => {
        const [sender, amount, , expiresAt, claimed] = r as readonly [
          `0x${string}`,
          bigint,
          `0x${string}`,
          bigint,
          boolean,
        ];
        if (/^0x0{40}$/.test(sender)) {
          setPhase("noEscrow");
          return;
        }
        setEscrow({ sender, amount, expiresAt, claimed });
        if (claimed) {
          // storage can't tell claim vs cancel vs reclaim apart — read the event
          const outcome = await getEscrowOutcome(id);
          setPhase(
            outcome === "cancelled" ? "cancelled" : outcome === "reclaimed" ? "expired" : "claimed",
          );
        } else if (expiresAt * 1000n < BigInt(Date.now())) {
          setPhase("expired");
        } else {
          setPhase("ready");
        }
      })
      .catch(() => setPhase("noEscrow"));
  }, [params]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function claim() {
    if (escrow === null || params === null) return;
    const keyHex = /#k=([0-9a-fA-F]{64})/.exec(params.hash)?.[1];
    if (keyHex === undefined) {
      setPhase("badLink");
      return;
    }
    setError(null);
    setPhase("busy");
    try {
      // Payee account: real users → Mera passkey. Localhost dev → the burner
      // (lets the full claim + payout flow be tested in a browser quickly).
      const { isDevBurnerAvailable, getDevBurnerAccount } = await import("@/lib/chain/devWallet");
      let payeeAddress: `0x${string}`;
      if (isDevBurnerAvailable()) {
        const burner = getDevBurnerAccount();
        payeeAddress = burner.address;
        setBusyText("Dev mode — claiming to the local burner…");
      } else {
        setBusyText("Creating your account with your fingerprint…");
        const { login, createAccount, readCachedAccount } = await import("@/lib/chain/mera");
        const cached = readCachedAccount();
        const account = cached !== null ? await login() : await createAccount();
        payeeAddress = account.address;
      }
      setBusyText("Authorizing your claim…");
      const started = Date.now();
      const sig = await signClaimAuthorization({
        linkKeyPrivateKeyHex: keyHex,
        escrowId: BigInt(params.id),
        payee: payeeAddress,
      });
      setBusyText("Sending — your money is on its way…");
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          escrowId: params.id,
          payee: payeeAddress,
          sig,
          issuedAt: started,
        }),
      });
      const data: { ok?: boolean; txHash?: string; error?: string } = await res.json();
      if (!res.ok || data.ok !== true || data.txHash === undefined) {
        throw new Error(data.error ?? "Claim failed — try again");
      }
      const seconds = (Date.now() - started) / 1000;
      try {
        const { getAusdBalance } = await import("@/lib/chain/ausd");
        const bal = await getAusdBalance(payeeAddress);
        setBalanceAfter(formatUsd(bal));
      } catch {
        setBalanceAfter(null);
      }
      setReceipt({ seconds, txHash: data.txHash });
      setPhase("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong — try again.";
      if (/locked|sign in/i.test(msg)) {
        setError(msg + " Then tap claim again.");
      } else {
        setError(msg);
      }
      setPhase("ready");
    }
  }

  if (phase === "loading") {
    return (
      <Shell>
        <LoaderCircle className="mx-auto animate-spin text-muted" />
      </Shell>
    );
  }
  if (phase === "badLink") {
    return (
      <Shell>
        <p className="font-display text-xl font-bold text-ink">This link is incomplete</p>
        <p className="mt-2 text-sm text-muted">
          Claim links open the money — copy the full link exactly as it was sent to you.
        </p>
      </Shell>
    );
  }
  if (phase === "noEscrow") {
    return (
      <Shell>
        <p className="font-display text-xl font-bold text-ink">Nothing to claim here</p>
        <p className="mt-2 text-sm text-muted">Check the link — this escrow doesn&apos;t exist.</p>
      </Shell>
    );
  }
  if (phase === "claimed") {
    return (
      <Shell>
        <p className="font-display text-xl font-bold text-ink">Already claimed</p>
        <p className="mt-2 text-sm text-muted">The money in this link has been claimed.</p>
      </Shell>
    );
  }
  if (phase === "cancelled") {
    return (
      <Shell>
        <p className="font-display text-xl font-bold text-ink">This transfer was cancelled</p>
        <p className="mt-2 text-sm text-muted">
          The sender cancelled it and got the money back — ask them to send again.
        </p>
      </Shell>
    );
  }
  if (phase === "expired") {
    return (
      <Shell>
        <p className="font-display text-xl font-bold text-ink">This link expired</p>
        <p className="mt-2 text-sm text-muted">
          The sender has been refunded — ask them to send it again.
        </p>
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Shell>
        <p className="font-display text-xl font-bold text-ink">Something&apos;s off</p>
        <p className="mt-2 text-sm text-muted">{error}</p>
      </Shell>
    );
  }
  if (phase === "done" && receipt !== null && escrow !== null) {
    return (
      <Shell>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <ShieldCheck size={32} className="text-primary" />
        </div>
        <p className="mt-4 text-center font-display text-3xl font-bold text-ink">
          {formatUsd(escrow.amount)} is yours
        </p>
        <p className="mt-1 text-center text-sm text-muted">
          Settled in {receipt.seconds.toFixed(1)} seconds{balanceAfter !== null ? ` · balance ${balanceAfter}` : ""}
        </p>
        <div className="mt-6 rounded-2xl bg-card p-5 text-sm shadow-sm">
          <Row label="You received" value={formatUsd(escrow.amount)} strong />
          <Row label="You paid" value="$0.00 — the sender covered everything" muted />
          <Row label="Western Union" value="~$6–18 on this amount" muted />
          <Row label="Typical app" value="~1–3% hidden in the rate" muted />
        </div>
        <a
          href={`${config.explorerUrl}/tx/${receipt.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 text-center text-xs font-medium text-primary underline underline-offset-4"
        >
          See it on-chain ↗
        </a>
        {showPayout ? (
          <div className="mt-5">
            <BankPayout
              escrowId={BigInt(params!.id)}
              amountMicroAusd={escrow.amount}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPayout(true)}
            className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-base font-semibold text-primary active:opacity-80"
          >
            Get naira in your bank →
          </button>
        )}
        <Link
          href="/"
          className="mt-auto flex min-h-[48px] items-center justify-center text-sm font-semibold text-muted"
        >
          What is senda?
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      {escrow !== null && (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            You&apos;ve been sent
          </p>
          <p className="mt-1 text-center font-display text-5xl font-bold tabular-nums text-ink">
            {formatUsd(escrow.amount)}
          </p>
          <p className="mt-2 text-center text-sm text-muted">from {shortSender(escrow.sender)}</p>
        </>
      )}
      {error !== null && (
        <p className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>
      )}
      <button
        type="button"
        onClick={claim}
        disabled={phase === "busy"}
        className="mt-6 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-white disabled:opacity-60"
      >
        {phase === "busy" ? (
          <>
            <LoaderCircle size={20} className="animate-spin" /> {busyText}
          </>
        ) : (
          <>
            <Fingerprint size={22} /> Claim with your fingerprint
          </>
        )}
      </button>
      <p className="mt-3 text-center text-xs leading-relaxed text-muted">
        Your fingerprint creates your private account — no app store, no seed phrase.
        Claiming is free; the sender paid the fee.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col justify-center px-6 pb-10 pt-12">
      {children}
    </main>
  );
}

function Row(params: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={params.muted === true ? "text-muted" : "text-ink"}>{params.label}</span>
      <span
        className={
          params.strong === true
            ? "font-display text-base font-bold tabular-nums text-primary"
            : params.muted === true
              ? "text-muted"
              : "font-semibold tabular-nums text-ink"
        }
      >
        {params.value}
      </span>
    </div>
  );
}

const ESCROWS_ABI = [
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
