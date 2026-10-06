"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Delete, LoaderCircle, ShieldCheck } from "lucide-react";
import RequireAuth from "@/features/auth/RequireAuth";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAusdBalance } from "@/features/balance/useAusdBalance";
import { config } from "@/lib/config";
import { generateLinkKey, keyHashFor } from "@/lib/chain/linkKey";
import { approveAndDeposit } from "@/lib/chain/escrow";
import { LinkShare } from "@/features/send/LinkShare";
import {
  QUICK_AMOUNTS,
  draftToMicroAusd,
  formatNgn,
  isValidPhone,
  toE164,
  useFeeLabel,
  useNgnRate,
} from "@/features/send/sendModel";
import { formatUsd } from "@/lib/format";

type Step = "amount" | "phone" | "confirm" | "done";

const COUNTRY = { code: "234", dial: "+234", name: "Nigeria" };

function SendFlow() {
  const { address, getSignerClient } = useAuth();
  const { value: balance, reload: refetch } = useAusdBalance(address);
  const { rate } = useNgnRate();
  const feeLabel = useFeeLabel();

  const [step, setStep] = useState<Step>("amount");
  const [dollars, setDollars] = useState("");
  const [localPhone, setLocalPhone] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: bigint; url: string; txHash: string } | null>(null);

  const amount = draftToMicroAusd(dollars);
  const balanceBig = balance ?? 0n;
  const insufficient = amount > balanceBig;
  const e164 = toE164(localPhone, COUNTRY.code);
  const phoneOk = isValidPhone(e164);

  function pressKey(k: string) {
    setError(null);
    if (k === "del") {
      setDollars((d) => (d.length <= 1 ? "" : d.slice(0, -1)));
      return;
    }
    setDollars((d) => {
      if (d === "" && k === "0") return d;
      if (d.length >= 6) return d; // $999,999 cap for v1
      return d + k;
    });
  }

  async function confirmAndSend() {
    const signer = getSignerClient();
    if (signer === null || address === null) {
      setError("Your wallet is locked — go back to the home screen and sign in.");
      return;
    }
    if (!config.escrowAddress) {
      setError(
        config.isTestnet
          ? "The escrow contract isn't deployed on testnet yet — it's being deployed now. Check back shortly."
          : "The escrow contract isn't live on mainnet yet.",
      );
      return;
    }
    setBusy("Preparing your secure claim link…");
    setError(null);
    try {
      const linkKey = generateLinkKey();
      setBusy("Locking your money in escrow (1 of 2)…");
      const receipt = await approveAndDeposit({
        signer,
        senderAddress: address,
        linkKeyAddress: linkKey.address,
        amountMicroAusd: amount,
      });
      setBusy("Creating your claim link…");
      const keyHash = await keyHashFor(linkKey.privateKeyHex);
      // TASK-403: persist {escrowId, keyHash, amount, status} to Supabase when
      // env creds are present — the link itself is self-sufficient (id + #k=).
      void keyHash;
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${base}/claim/${receipt.escrowId.toString()}#k=${linkKey.privateKeyHex}`;
      setResult({ id: receipt.escrowId, url, txHash: receipt.depositTxHash });
      setStep("done");
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — try again.");
      setStep("confirm");
    } finally {
      setBusy(null);
    }
  }

  if (step === "done" && result !== null) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col px-6 pb-10 pt-8">
        <div className="mb-5 flex items-center justify-center gap-2 rounded-full bg-primary/10 px-4 py-2">
          <ShieldCheck size={16} className="text-primary" />
          <p className="text-sm font-semibold text-primary">Money is locked in escrow</p>
        </div>
        <LinkShare claimUrl={result.url} txHash={result.txHash} />
        <Link
          href="/history"
          className="mt-6 flex min-h-[48px] items-center justify-center text-sm font-semibold text-muted"
        >
          View all transfers
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col px-6 pb-10 pt-8">
      {step === "phone" && (
        <button
          type="button"
          onClick={() => setStep("amount")}
          className="mb-2 flex min-h-[44px] w-24 items-center gap-1 text-sm font-semibold text-muted"
        >
          <ArrowLeft size={16} /> Back
        </button>
      )}

      {step === "amount" && (
        <>
          <p className="font-display text-2xl font-bold text-ink">How much?</p>
          <div className="mt-4 rounded-2xl bg-card p-5 shadow-sm">
            <p className="text-center font-display text-5xl font-bold tabular-nums text-ink">
              ${dollars === "" ? "0" : Number(dollars).toLocaleString("en-US")}
            </p>
            <p className="mt-1 text-center text-sm text-muted">
              ≈ {formatNgn(amount, rate ?? 1330)} to {COUNTRY.name}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setDollars(String(q))}
                  className="min-h-[36px] rounded-full border border-line px-4 text-sm font-semibold text-ink active:opacity-70"
                >
                  ${q}
                </button>
              ))}
            </div>
          </div>
          {insufficient && (
            <p className="mt-3 text-center text-sm font-medium text-danger">
              That&apos;s more than your balance ({formatUsd(balanceBig)})
            </p>
          )}
          <div className="mt-4 grid flex-1 grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
              k === "" ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => pressKey(k)}
                  className="flex min-h-[56px] items-center justify-center rounded-2xl bg-card text-xl font-semibold tabular-nums text-ink shadow-sm active:bg-surface"
                >
                  {k === "del" ? <Delete size={20} /> : k}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            disabled={amount === 0n || insufficient}
            onClick={() => setStep("phone")}
            className="mt-4 flex min-h-[52px] items-center justify-center rounded-full bg-primary text-base font-semibold text-white disabled:opacity-40"
          >
            Next
          </button>
        </>
      )}

      {step === "phone" && (
        <>
          <p className="font-display text-2xl font-bold text-ink">Who is it for?</p>
          <div className="mt-4 rounded-2xl bg-card p-5 shadow-sm">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted">
              Phone number
            </label>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-lg bg-surface px-3 py-2 text-base font-semibold tabular-nums text-ink">
                {COUNTRY.dial}
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="803 123 4567"
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value.replace(/[^\d ]/g, ""))}
                className="min-h-[48px] w-full rounded-lg border border-line px-3 text-base tabular-nums text-ink focus:border-primary focus:outline-none"
              />
            </div>
            <div className="mt-4 border-t border-line pt-3 text-sm">
              <CostBlock amount={amount} feeLabel={feeLabel} rate={rate} />
            </div>
          </div>
          <button
            type="button"
            disabled={!phoneOk}
            onClick={() => setStep("confirm")}
            className="mt-4 flex min-h-[52px] items-center justify-center rounded-full bg-primary text-base font-semibold text-white disabled:opacity-40"
          >
            Review
          </button>
        </>
      )}

      {step === "confirm" && (
        <>
          <p className="font-display text-2xl font-bold text-ink">Confirm & send</p>
          <div className="mt-4 rounded-2xl bg-card p-5 shadow-sm">
            <p className="text-center font-display text-4xl font-bold tabular-nums text-ink">
              {formatUsd(amount)}
            </p>
            <p className="mt-1 text-center text-sm text-muted">
              to {COUNTRY.dial} {localPhone}
            </p>
            <div className="mt-4 border-t border-line pt-3 text-sm">
              <CostBlock amount={amount} feeLabel={feeLabel} rate={rate} />
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              Arrives in about a second, once they claim.
            </p>
          </div>
          {error !== null && (
            <p className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>
          )}
          <button
            type="button"
            disabled={busy !== null}
            onClick={confirmAndSend}
            className="mt-4 flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-white disabled:opacity-60"
          >
            {busy !== null && <LoaderCircle size={18} className="animate-spin" />}
            {busy ?? "Confirm & send"}
          </button>
          <button
            type="button"
            onClick={() => setStep("phone")}
            disabled={busy !== null}
            className="mt-3 flex min-h-[44px] items-center justify-center text-sm font-semibold text-muted"
          >
            Edit details
          </button>
        </>
      )}
    </main>
  );
}

function CostBlock(params: { amount: bigint; feeLabel: string; rate: number | null }) {
  const rate = params.rate ?? 1330;
  return (
    <div className="space-y-1.5">
      <Row label="You send" value={formatUsd(params.amount)} />
      <Row label="Fee" value={params.feeLabel} muted />
      <Row label="Rate" value={`1 USD ≈ ₦${rate.toFixed(0)}`} muted />
      <Row label="They get" value={formatNgn(params.amount, rate)} strong />
    </div>
  );
}

function Row(params: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={params.muted === true ? "text-muted" : "text-ink"}>{params.label}</span>
      <span
        className={
          params.strong === true
            ? "font-display text-lg font-bold tabular-nums text-primary"
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

export default function SendPage() {
  return (
    <RequireAuth>
      <SendFlow />
    </RequireAuth>
  );
}
