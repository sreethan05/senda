"use client";

import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getEvmAddress,
  getPasskeyPrfOutput,
  isMeraError,
  type EvmAddress,
  type PasskeyCredentialMetadata,
  type Secp256k1SigningSession,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { createWalletClient, http, isAddress } from "viem";
import { config } from "@/lib/config";

/**
 * TASK-201 — Mera passkey → derived EOA (the ONLY production account layer).
 * Reference: docs/research/mera-auth-pattern.tsx, docs/RESEARCH_TECH.md §1.
 *
 * Derived account is a plain EOA: PRF output (32B) → BIP-39 mnemonic →
 * BIP-32 m/44'/60'/0'/0/{index} → secp256k1 key. The mnemonic imports into
 * MetaMask and reproduces the same address (free recovery path).
 *
 * Browser-only: import only from `"use client"` modules. Ceremonies must run
 * inside a user gesture (WebAuthn). Switch on isMeraError(err).code, never
 * .message. Monad quirk: every write passes an explicit tight `gas`.
 */

export interface MeraAccount {
  session: Secp256k1SigningSession;
  address: EvmAddress;
}

const CREDENTIAL_STORAGE_KEY = "senda.credential";

interface StoredCredential {
  credentialId: string;
  transports?: PasskeyCredentialMetadata["transports"];
  address?: EvmAddress;
}

/** rpId is forever — bound to the registrable domain at build time. */
export function getRpId(): string {
  const fromEnv = process.env.NEXT_PUBLIC_RP_ID;
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
  if (typeof window !== "undefined" && window.location.hostname !== "") {
    return window.location.hostname;
  }
  return "localhost";
}

/** PRF output (32B) → secp256k1 private key at the given BIP-44 index. */
export function deriveEvmPrivateKey(prfOutput: Uint8Array, index = 0): Uint8Array {
  if (prfOutput.length !== 32) {
    throw new Error(`Invalid PRF output length ${prfOutput.length} — expected 32 bytes`);
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid derivation index ${index} — expected a non-negative integer`);
  }
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  seed.fill(0);
  if (node.privateKey === null) throw new Error("derivation produced no key");
  return node.privateKey;
}

function unlockFromPrf(prfOutput: Uint8Array): MeraAccount {
  try {
    const session = createSecp256k1SigningSession({
      privateKey: deriveEvmPrivateKey(prfOutput),
    });
    return { session, address: getEvmAddress(session.publicKey) };
  } finally {
    prfOutput.fill(0);
  }
}

function readStoredCredential(): StoredCredential | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CREDENTIAL_STORAGE_KEY);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (typeof record.credentialId !== "string" || record.credentialId === "") return null;
  const stored: StoredCredential = { credentialId: record.credentialId };
  if (Array.isArray(record.transports)) {
    stored.transports = record.transports.filter(
      (t): t is NonNullable<PasskeyCredentialMetadata["transports"]>[number] =>
        typeof t === "string",
    );
  }
  if (typeof record.address === "string" && isAddress(record.address)) {
    stored.address = record.address;
  }
  return stored;
}

function writeStoredCredential(stored: StoredCredential): void {
  window.localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(stored));
}

/** Cached {address, credentialId} for the locked UI — no key material. */
export function readCachedAccount(): { address: EvmAddress; credentialId: string } | null {
  const stored = readStoredCredential();
  if (stored === null || stored.address === undefined) return null;
  return { address: stored.address, credentialId: stored.credentialId };
}

export function clearStoredCredential(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
  }
}

/** CREATE (first visit) — call inside a user gesture (WebAuthn ceremony). */
export async function createAccount(): Promise<MeraAccount> {
  const created = await createPasskeyWithPrfOutput({
    rp: { id: getRpId(), name: "senda" },
    user: { name: "senda-user", displayName: `senda account ${new Date().toISOString()}` },
  });
  const account = unlockFromPrf(created.prfOutput);
  writeStoredCredential({
    credentialId: created.credentialId,
    ...(created.transports !== undefined ? { transports: created.transports } : {}),
    address: account.address,
  });
  return account;
}

/** LOGIN (returning user) — one biometric prompt per page session. */
export async function login(): Promise<MeraAccount> {
  const stored = readStoredCredential();
  const { credentialId, prfOutput } = await getPasskeyPrfOutput({
    rpId: getRpId(),
    ...(stored !== null
      ? {
          credential: {
            credentialId: stored.credentialId,
            ...(stored.transports !== undefined ? { transports: stored.transports } : {}),
          },
        }
      : {}),
  });
  const account = unlockFromPrf(prfOutput);
  const previous = readStoredCredential();
  writeStoredCredential({
    credentialId,
    ...(previous?.transports !== undefined ? { transports: previous.transports } : {}),
    address: account.address,
  });
  return account;
}

/** Sign-out — permanently zeroes the session key copy. */
export function lockAccount(account: MeraAccount): void {
  account.session.end();
}

/** viem local account for the session — silent signing after unlock. */
export function toViemAccountFromSession(session: Secp256k1SigningSession) {
  return toViemAccount(session);
}

/** Wallet client for the session — the only place components get one. */
export function createWalletClientForSession(session: Secp256k1SigningSession) {
  return createWalletClient({
    account: toViemAccount(session),
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

export { isMeraError };
export type { MeraErrorCode } from "@category-labs/mera";
export type { Secp256k1SigningSession };
