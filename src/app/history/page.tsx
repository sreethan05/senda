"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import RequireAuth from "@/features/auth/RequireAuth";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAusdBalance } from "@/features/balance/useAusdBalance";
import { getMyEscrows, cancelEscrow, reclaimEscrow, type MyEscrow } from "@/lib/chain/escrow";
import { explorerTxUrl } from "@/lib/config";
import { formatUsd } from "@/lib/format";

/** Transfer history (TASK-505) + cancel (TASK-504). Source: on-chain events. */

const STATUS_STYLES: Record<MyEscrow["status"], { label: string; cls: string }> = {
  pending: { label: "Awaiting claim", cls: "bg-primary/15 text-primary" },
  claimed: { label: "Claimed", cls: "bg-emerald-400/15 text-emerald-300" },
  cancelled: { label: "Cancelled", cls: "bg-line text-muted" },
  expired: { label: "Expired — return available", cls: "bg-line text-muted" },
  refunded: { label: "Refunded", cls: "bg-line text-muted" },
  complete: { label: "Complete", cls: "bg-line text-muted" },
};

function History() {
  const { address, getSignerClient } = useAuth();
  const { reload: refetchBalance } = useAusdBalance(address);
  const [items, setItems] = useState<MyEscrow[] | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cancelling, setCancelling] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- on-chain event scan on mount, guarded */
  const load = useCallback(async (offset = 0) => {
    if (address === null) return;
    try {
      const page = await getMyEscrows(address, offset);
      setItems((current) => offset === 0 || current === null ? page.items : [...current, ...page.items]);
      setNextOffset(page.nextOffset);
    } catch {
      setError("Couldn't load your transfers — pull to retry.");
    }
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function doCancel(id: bigint) {
    const signer = getSignerClient();
    if (signer === null || address === null) return;
    setCancelling(id);
    setError(null);
    try {
      await cancelEscrow({ signer, senderAddress: address, id });
      await load();
      refetchBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed — try again.");
    } finally {
      setCancelling(null);
    }
  }

  async function loadMore() {
    if (nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    try {
      await load(nextOffset);
    } finally {
      setLoadingMore(false);
    }
  }

  async function doReclaim(id: bigint) {
    const signer = getSignerClient();
    if (signer === null) return;
    setCancelling(id);
    setError(null);
    try {
      await reclaimEscrow({ signer, id });
      await load();
      refetchBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed — try again.");
    } finally {
      setCancelling(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col px-6 pb-10 pt-8">
      <Link href="/" className="mb-2 flex min-h-[44px] w-24 items-center gap-1 text-sm font-semibold text-muted">
        <ArrowLeft size={16} /> Home
      </Link>
      <p className="font-display text-2xl font-bold text-ink">Your transfers</p>

      {error !== null && (
        <p className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>
      )}

      {items === null ? (
        <div className="mt-10 flex justify-center">
          <LoaderCircle className="animate-spin text-muted" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-card p-6 text-center shadow-sm">
          <p className="text-base font-semibold text-ink">No transfers yet</p>
          <p className="mt-1 text-sm text-muted">Send your first one — it lands in seconds.</p>
          <Link
            href="/send"
            className="mt-4 inline-flex min-h-[48px] items-center rounded-full bg-primary px-6 text-sm font-semibold text-white"
          >
            Send money
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((it) => (
            <li key={it.id.toString()} className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-display text-xl font-bold tabular-nums text-ink">
                  {/* every terminal op zeroes the amount — show the outcome, not $0.00 */}
                  {it.amount > 0n
                    ? formatUsd(it.amount)
                    : it.status === "claimed"
                      ? "Claimed ✓"
                      : it.status === "cancelled"
                        ? "Cancelled"
                        : it.status === "refunded"
                          ? "Refunded"
                          : "—"}
                </p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[it.status].cls}`}
                >
                  {STATUS_STYLES[it.status].label}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>
                  Escrow #{it.id.toString()} ·{" "}
                  {new Date(Number(it.expiresAt) * 1000).toLocaleDateString()}
                </span>
                {it.depositTxHash !== null && (
                  <a
                    href={explorerTxUrl(it.depositTxHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    On-chain ↗
                  </a>
                )}
              </div>
              {it.status === "pending" && (
                <button
                  type="button"
                  onClick={() => doCancel(it.id)}
                  disabled={cancelling !== null}
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-danger/40 text-sm font-semibold text-danger disabled:opacity-50"
                >
                  {cancelling === it.id && <LoaderCircle size={14} className="animate-spin" />}
                  {cancelling === it.id ? "Cancelling…" : "Cancel & get back"}
                </button>
              )}
              {it.status === "expired" && (
                <button
                  type="button"
                  onClick={() => doReclaim(it.id)}
                  disabled={cancelling !== null}
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-primary/40 text-sm font-semibold text-primary disabled:opacity-50"
                >
                  {cancelling === it.id && <LoaderCircle size={14} className="animate-spin" />}
                  {cancelling === it.id ? "Returning funds…" : "Return expired funds"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {nextOffset !== null && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 flex min-h-[48px] items-center justify-center rounded-full border border-line text-sm font-semibold text-muted disabled:opacity-50"
        >
          {loadingMore ? "Loading transfers…" : "Load older transfers"}
        </button>
      )}
    </main>
  );
}

export default function HistoryPage() {
  return (
    <RequireAuth>
      <History />
    </RequireAuth>
  );
}
