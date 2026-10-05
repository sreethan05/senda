"use client";

import Link from "next/link";
import { explorerAddressUrl, shortAddress } from "@/lib/config";
import { useAuth } from "./AuthProvider";

const buttonPrimary =
  "flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-primary px-5 text-base font-semibold text-white transition-colors active:bg-emerald-600 disabled:opacity-50";
const buttonSecondary =
  "flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-stone-200 bg-card px-5 text-base font-semibold text-ink transition-colors active:bg-stone-100 disabled:opacity-50";

export default function AuthPanel() {
  const {
    status,
    address,
    authMethod,
    devBurnerAvailable,
    hasCachedCredential,
    busyOp,
    error,
    create,
    login,
    useBurner,
    lock,
    forgetDevice,
    clearError,
  } = useAuth();

  if (status === "loading") {
    return (
      <div className="rounded-2xl bg-card p-6 shadow-sm" aria-live="polite">
        <p className="text-center text-base text-muted">Loading…</p>
      </div>
    );
  }

  if (status === "ready" && address !== null) {
    return (
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <p className="text-sm text-muted">
          Signed in as
          {authMethod === "burner" && (
            <span className="ml-2 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">DEV</span>
          )}
        </p>
        <a
          href={explorerAddressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-xl font-semibold tabular-nums text-ink underline decoration-stone-200 underline-offset-4"
        >
          {shortAddress(address)}
        </a>
        <div className="mt-5 flex flex-col gap-3">
          <Link href="/send" className={buttonPrimary}>
            Send money
          </Link>
          <Link href="/history" className={buttonSecondary}>
            Activity
          </Link>
          <button type="button" onClick={lock} className="min-h-[48px] text-sm font-medium text-muted">
            Lock
          </button>
        </div>
      </div>
    );
  }

  const busy = busyOp !== null;
  const busyLabel =
    busyOp === "create" ? "Waiting for your fingerprint…" : busyOp === "login" ? "Checking your security key…" : null;

  return (
    <div className="rounded-2xl bg-card p-6 shadow-sm">
      {hasCachedCredential && address !== null ? (
        <p className="text-center text-base text-ink">
          Welcome back, <span className="font-semibold tabular-nums">{shortAddress(address)}</span>
        </p>
      ) : (
        <p className="text-center text-base text-ink">Sign in with your fingerprint — no password needed.</p>
      )}
      <div className="mt-5 flex flex-col gap-3">
        {hasCachedCredential ? (
          <>
            <button type="button" onClick={() => void login()} disabled={busy} className={buttonPrimary}>
              {busyLabel ?? "Log in"}
            </button>
            <button type="button" onClick={forgetDevice} disabled={busy} className={buttonSecondary}>
              Use a different account
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => void create()} disabled={busy} className={buttonPrimary}>
              {busyLabel ?? "Create account"}
            </button>
            <button type="button" onClick={() => void login()} disabled={busy} className={buttonSecondary}>
              I already have one — log in
            </button>
          </>
        )}
      </div>
      {devBurnerAvailable && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-800">DEV ONLY — local burner, never real funds.</p>
          <button
            type="button"
            onClick={useBurner}
            disabled={busy}
            className="mt-2 min-h-[48px] w-full rounded-xl text-sm font-semibold text-amber-800 disabled:opacity-50"
          >
            Use dev burner
          </button>
        </div>
      )}
      {error !== null && (
        <div className="mt-4 rounded-xl bg-red-50 p-4" role="alert">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={clearError}
            className="mt-2 min-h-[48px] w-full text-sm font-semibold text-danger"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
