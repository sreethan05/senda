"use client";

import { useMemo, useState } from "react";
import { Banknote, Building2, Check, LoaderCircle } from "lucide-react";
import { useNgnRate } from "@/features/send/sendModel";
import { formatUsd } from "@/lib/format";

/**
 * Bank cash-out (the off-ramp handoff). PRODUCTION: this posts to a licensed
 * Nigerian VASP (Busha / Yellow Card) which pays naira to the bank account in
 * minutes. DEMO: we generate the same payout-order artifact the partner would
 * receive and label it clearly as a simulated handoff — honest, not fake-real.
 */

const BANKS = [
  "GTBank", "Access Bank", "Zenith Bank", "Kuda MFB", "Opay",
  "First Bank", "UBA", "Moniepoint", "Palmpay", "Sterling Bank",
] as const;

export function BankPayout(params: { escrowId: bigint; amountMicroAusd: bigint }) {
  const { rate } = useNgnRate();
  const [bank, setBank] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [order, setOrder] = useState<null | {
    ref: string;
    naira: number;
    fee: number;
    net: number;
  }>(null);
  const [busy, setBusy] = useState(false);

  const acctOk = /^\d{10}$/.test(accountNumber);
  const nameOk = accountName.trim().length >= 3;
  const rateN = rate ?? 1330;

  const quote = useMemo(() => {
    const usd = Number(params.amountMicroAusd) / 1e6;
    const gross = usd * rateN;
    const fee = Math.round(gross * 0.01); // partner spread, ~1% all-in — shown, never hidden
    return { gross, fee, net: gross - fee };
  }, [params.amountMicroAusd, rateN]);

  function generateOrder() {
    setBusy(true);
    // Simulated partner latency — production calls the VASP quote endpoint.
    setTimeout(() => {
      setOrder({
        ref: `PO-${params.escrowId.toString().padStart(6, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`,
        naira: Math.round(quote.net),
        fee: quote.fee,
        net: quote.net,
      });
      setBusy(false);
    }, 900);
  }

  if (order !== null) {
    return (
      <div className="rounded-2xl border border-primary/40 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Check size={18} className="text-primary" />
          <p className="text-sm font-bold text-primary">Payout order created</p>
        </div>
        <div className="mt-3 space-y-1.5 text-sm">
          <Row label="Reference" value={order.ref} />
          <Row label="Bank" value={bank} />
          <Row label="Account" value={`${accountNumber} · ${accountName}`} />
          <Row label="You cash out" value={formatUsd(params.amountMicroAusd)} />
          <Row label="Partner fee (~1%)" value={`₦${order.fee.toLocaleString("en-US")}`} muted />
          <Row label="You receive" value={`₦${order.net.toLocaleString("en-US")}`} strong />
        </div>
        <p className="mt-3 rounded-lg bg-surface p-2.5 text-[11px] leading-relaxed text-muted">
          DEMO PREVIEW — in production this order is handed to a licensed Nigerian
          VASP (Busha / Yellow Card) which pays your bank in minutes. No naira moves
          in this demo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Banknote size={18} className="text-primary" />
        <p className="text-sm font-bold text-ink">Get naira in your bank</p>
      </div>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">Bank</label>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {BANKS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBank(b)}
            className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold ${
              bank === b ? "border-primary bg-primary/10 text-primary" : "border-line text-muted"
            }`}
          >
            <Building2 size={12} /> {b}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">Account number</label>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={10}
        placeholder="0123456789"
        value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
        className="mt-1.5 min-h-[48px] w-full rounded-lg border border-line bg-surface px-3 text-base tabular-nums text-ink focus:border-primary focus:outline-none"
      />

      <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted">Account name</label>
      <input
        type="text"
        placeholder="As registered at your bank"
        value={accountName}
        onChange={(e) => setAccountName(e.target.value)}
        className="mt-1.5 min-h-[48px] w-full rounded-lg border border-line bg-surface px-3 text-base text-ink focus:border-primary focus:outline-none"
      />

      <div className="mt-4 border-t border-line pt-3 text-sm">
        <div className="flex justify-between py-0.5">
          <span className="text-muted">You cash out</span>
          <span className="font-semibold tabular-nums text-ink">{formatUsd(params.amountMicroAusd)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-muted">Rate</span>
          <span className="tabular-nums text-muted">1 USD ≈ ₦{rateN.toFixed(0)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-muted">Partner fee (~1%, shown always)</span>
          <span className="tabular-nums text-muted">₦{quote.fee.toLocaleString("en-US")}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-ink">You receive</span>
          <span className="font-display text-lg font-bold tabular-nums text-primary">
            ₦{quote.net.toLocaleString("en-US")}
          </span>
        </div>
      </div>

      <button
        type="button"
        disabled={!bank || !acctOk || !nameOk || busy}
        onClick={generateOrder}
        className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-on-primary disabled:opacity-40"
      >
        {busy && <LoaderCircle size={18} className="animate-spin" />}
        {busy ? "Creating payout order…" : "Cash out to bank"}
      </button>
      <p className="mt-2 text-center text-[11px] text-muted">
        Production: paid by a licensed partner (Busha / Yellow Card). Demo shows the exact order they would receive.
      </p>
    </div>
  );
}

function Row(params: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={params.muted === true ? "shrink-0 text-muted" : "shrink-0 text-ink"}>{params.label}</span>
      <span
        className={
          params.strong === true
            ? "text-right font-display text-base font-bold tabular-nums text-primary"
            : params.muted === true
              ? "text-right text-muted"
              : "text-right font-semibold text-ink"
        }
      >
        {params.value}
      </span>
    </div>
  );
}
