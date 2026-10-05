"use client";

import { formatUsd } from "@/lib/format";
import type { EvmAddress } from "@/lib/chain/mera";
import { useAusdBalance } from "./useAusdBalance";

/** Dominant-number balance (DESIGN.md Home) with loading / error+retry / empty states. */
export default function BalanceCard({ address }: { address: EvmAddress }) {
  const { status, value, reload } = useAusdBalance(address);

  return (
    <div className="rounded-2xl bg-card p-6 shadow-sm" aria-live="polite">
      <p className="text-sm text-muted">Balance</p>
      {status === "loading" && (
        <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-ink">…</p>
      )}
      {status === "error" && (
        <>
          <p className="mt-1 text-base text-danger">Couldn&apos;t load your balance.</p>
          <button
            type="button"
            onClick={reload}
            className="mt-2 min-h-[48px] text-sm font-semibold text-danger"
          >
            Try again
          </button>
        </>
      )}
      {status === "ready" && value !== null && (
        <>
          <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-ink">
            {formatUsd(value)}
          </p>
          {value === 0n && <p className="mt-1 text-sm text-muted">No funds yet.</p>}
        </>
      )}
    </div>
  );
}
