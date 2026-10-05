"use client";

import { useCallback, useEffect, useState } from "react";
import { getAusdBalance } from "@/lib/chain/ausd";
import type { EvmAddress } from "@/lib/chain/mera";

export type BalanceStatus = "loading" | "ready" | "error";

export interface AusdBalance {
  status: BalanceStatus;
  /** Raw micro-dollars; null until the first successful read. */
  value: bigint | null;
  reload: () => void;
}

export function useAusdBalance(address: EvmAddress | null): AusdBalance {
  const [nonce, setNonce] = useState(0);
  const [status, setStatus] = useState<BalanceStatus>("loading");
  const [value, setValue] = useState<bigint | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- chain fetch on mount/address change, guarded against races */
  useEffect(() => {
    if (address === null) {
      setStatus("ready");
      setValue(null);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    getAusdBalance(address).then(
      (v) => {
        if (cancelled) return;
        setValue(v);
        setStatus("ready");
      },
      () => {
        if (cancelled) return;
        setStatus("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [address, nonce]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { status, value, reload };
}
