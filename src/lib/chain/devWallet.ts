import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "@/lib/config";

/**
 * TASK-203 — DEV ONLY burner wallet: local dev/seeding without a passkey ceremony.
 *
 * Availability requires ALL of:
 *   1. a development runtime (`NODE_ENV !== "production"` — production builds
 *      refuse even if the var leaks into the bundle),
 *   2. `NEXT_PUBLIC_DEV_BURNER_KEY` set (lives only in `.env.local`, gitignored).
 *
 * The key must hold trivial funds. Never set it in preview/production envs.
 * Nothing here touches localStorage — the burner is explicit every reload.
 */

type HexKey = `0x${string}`;

function readKey(): HexKey | null {
  if (process.env.NODE_ENV === "production") return null;
  const raw = process.env.NEXT_PUBLIC_DEV_BURNER_KEY;
  if (raw === undefined || raw === "") return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) return null;
  return raw as HexKey;
}

export function isDevBurnerAvailable(): boolean {
  const key = readKey();
  if (key === null) return false;
  try {
    privateKeyToAccount(key);
    return true;
  } catch {
    return false;
  }
}

export function getDevBurnerAccount() {
  const key = readKey();
  if (key === null) {
    throw new Error("Dev burner unavailable — local dev only (.env.local).");
  }
  try {
    return privateKeyToAccount(key);
  } catch {
    throw new Error("Dev burner key is not a valid secp256k1 private key.");
  }
}

/** Wallet client for the burner — dev seeding only, never production. */
export function createDevWalletClient() {
  return createWalletClient({
    account: getDevBurnerAccount(),
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}
