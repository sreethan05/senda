import { AUSD_DECIMALS } from "./config";

/**
 * Money formatting. BigInt math throughout — float-free, exact at any size.
 * Zero crypto jargon in output (DESIGN.md): users see "$1,234.50".
 */

/** Micro-dollars (6 decimals) → "$1,234.50", rounded to the cent. */
export function formatUsd(microAusd: bigint): string {
  if (microAusd < 0n) throw new Error("Negative money amount");
  const microsPerCent = 10n ** BigInt(AUSD_DECIMALS - 2);
  const totalCents = (microAusd + microsPerCent / 2n) / microsPerCent;
  const dollars = totalCents / 100n;
  const cents = totalCents % 100n;
  const grouped = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${grouped}.${cents.toString().padStart(2, "0")}`;
}
