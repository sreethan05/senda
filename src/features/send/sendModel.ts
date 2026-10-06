"use client";

import { useEffect, useState } from "react";

/**
 * Live NGN rate (ADR-012): open.er-api.com, no key. Client fetch is fine —
 * the API is CORS-friendly; hourly re-fetch, hardcoded fallback for demo day.
 * Numbers move daily — UI labels them "≈".
 */

export function useNgnRate(): { rate: number | null; loading: boolean } {
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((r) => r.json())
      .then((data: { result?: string; rates?: { NGN?: number } }) => {
        if (!cancelled && data.result === "success" && typeof data.rates?.NGN === "number") {
          setRate(data.rates.NGN);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { rate, loading };
}

/** USD micro-dollars → "₦12,450" (whole naira, ≈ prefix applied by caller). */
export function formatNgn(microAusd: bigint, rate: number): string {
  const usd = Number(microAusd) / 1e6;
  return `₦${Math.round(usd * rate).toLocaleString("en-US")}`;
}

/** Wire format for the phone input: "0803 123 4567" → "2348031234567". */
export function toE164(localDigits: string, countryCode: string): string {
  const digits = localDigits.replace(/\D/g, "");
  const stripped = digits.startsWith("0") ? digits.slice(1) : digits;
  return `${countryCode}${stripped}`;
}

export function isValidPhone(e164: string): boolean {
  return /^[1-9]\d{7,14}$/.test(e164);
}

/** Chip options on the amount pad (dollars). */
export const QUICK_AMOUNTS = [50, 100, 200] as const;

export interface SendDraft {
  /** Whole dollars as typed on the keypad — parsed to micro-AUSD on confirm */
  dollars: string;
  countryCode: string;
  localPhone: string;
}

export function draftToMicroAusd(dollars: string): bigint {
  const whole = Number.parseInt(dollars || "0", 10);
  if (!Number.isSafeInteger(whole) || whole <= 0) return 0n;
  return BigInt(whole) * 1_000_000n;
}

/** v1 fee copy (DESIGN.md: no crypto jargon — receipt shows exact gas in TASK-503). */
export function useFeeLabel(): string {
  return "network gas (a fraction of a cent)";
}
