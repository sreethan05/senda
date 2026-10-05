"use client";

import { useState } from "react";
import { explorerTxUrl } from "@/lib/config";
import { formatUsd } from "@/lib/format";
import { FAUCET_MINT_AMOUNT, isFaucetAvailable, requestTestFunds } from "@/lib/chain/faucet";
import type { EvmAddress } from "@/lib/chain/mera";
import { useAuth } from "@/features/auth/AuthProvider";

type FaucetState = "idle" | "pending" | "done" | "error";

/** Testnet-only faucet button. Renders nothing on mainnet. */
export default function FaucetButton({
  address,
  onFunded,
}: {
  address: EvmAddress;
  onFunded: () => void;
}) {
  const { getSignerClient } = useAuth();
  const [state, setState] = useState<FaucetState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isFaucetAvailable()) return null;

  async function claim() {
    if (state === "pending") return;
    setState("pending");
    setError(null);
    try {
      const client = getSignerClient();
      if (client === null) throw new Error("Sign in first, then try again.");
      const hash = await requestTestFunds(client, address);
      setTxHash(hash);
      setState("done");
      onFunded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setState("error");
    }
  }

  if (state === "done" && txHash !== null) {
    return (
      <div className="mt-4 rounded-xl bg-emerald-50 p-4" role="status">
        <p className="text-sm font-medium text-emerald-800">Test money is on its way.</p>
        <a
          href={explorerTxUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block min-h-[48px] text-sm font-semibold text-emerald-800 underline underline-offset-4"
        >
          View on MonadScan
        </a>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => void claim()}
        disabled={state === "pending"}
        className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-primary px-5 text-base font-semibold text-white transition-colors active:bg-emerald-600 disabled:opacity-50"
      >
        {state === "pending" ? "Requesting…" : `Get ${formatUsd(FAUCET_MINT_AMOUNT)} test money`}
      </button>
      <p className="mt-2 text-center text-xs text-muted">
        Test network only — you need a little test MON for the network fee (faucet.monad.xyz).
      </p>
      {state === "error" && error !== null && (
        <div className="mt-2 rounded-xl bg-red-50 p-4" role="alert">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void claim()}
            className="mt-1 min-h-[48px] w-full text-sm font-semibold text-danger"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
