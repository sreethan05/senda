// REFERENCE PATTERN — verified against @category-labs/mera@0.2.0 docs + demos
// (github.com/category-labs/mera demos/web + demos/shared). Phase 2 (TASK-201..204)
// implements from this. See docs/RESEARCH_TECH.md §1 for constraints and risks.
"use client";

import { monad } from "viem/chains"; // chain 143 — also monadTestnet (10143)
import { createPublicClient, createWalletClient, http } from "viem";
import {
  createPasskeyWithPrfOutput,
  getPasskeyPrfOutput,
  createSecp256k1SigningSession,
  getEvmAddress,
  type PasskeyCredentialMetadata,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem"; // requires viem >= 2.28
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

// rpId is FOREVER — passkey + PRF are bound to it. Use the registrable
// production domain (e.g. "senda.xyz", not "app.senda.xyz"), never localhost,
// for any account you intend to keep. Dev passkeys on localhost ≠ prod.
const RP_ID = "senda.example";
const METADATA_KEY = "senda.credential"; // stores {credentialId, transports} only — no key material

// PRF output (32B) -> BIP-39 mnemonic -> BIP-32 m/44'/60'/0'/0/{index} -> key.
// The mnemonic imports into MetaMask and reproduces the SAME address (free recovery path).
function deriveEvmPrivateKey(prfOutput: Uint8Array, index = 0): Uint8Array {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  if (node.privateKey === null) throw new Error("derivation produced no key");
  return node.privateKey;
}

// CREATE (first visit) — must run inside a user event handler (WebAuthn).
async function createAccount() {
  const created = await createPasskeyWithPrfOutput({
    rp: { id: RP_ID, name: "senda" },
    user: { name: "senda-user", displayName: `senda account ${new Date().toISOString()}` },
  });
  localStorage.setItem(
    METADATA_KEY,
    JSON.stringify({
      credentialId: created.credentialId,
      ...(created.transports ? { transports: created.transports } : {}),
    }),
  );
  return unlockFromPrf(created.prfOutput); // zero prfOutput after use
}

// LOGIN (returning user) — one biometric prompt per page session.
async function login() {
  const stored = localStorage.getItem(METADATA_KEY);
  const { prfOutput } = await getPasskeyPrfOutput({
    rpId: RP_ID,
    ...(stored ? { credential: JSON.parse(stored) as PasskeyCredentialMetadata } : {}),
  });
  return unlockFromPrf(prfOutput);
}

function unlockFromPrf(prfOutput: Uint8Array) {
  const session = createSecp256k1SigningSession({ privateKey: deriveEvmPrivateKey(prfOutput) });
  prfOutput.fill(0); // best-effort zeroing
  return { session, address: getEvmAddress(session.publicKey) };
}

// Signing: standard EOA — viem wallet client. Monad quirk: gas charged =
// DECLARED gasLimit, not gas used → always pass explicit, tight `gas`.
export async function sendTx(acct: { session: unknown }, tx: { to: `0x${string}`; data?: `0x${string}`; gas: bigint }) {
  const client = createWalletClient({
    account: toViemAccount(acct.session as Parameters<typeof toViemAccount>[0]),
    chain: monad,
    transport: http("https://rpc.monad.xyz"),
  });
  return client.sendTransaction({ ...tx, account: client.account });
}

// Error handling: switch on isMeraError(err).code — NOT .message (not a stable
// contract). PASSKEY_OPERATION_FAILED covers user-cancel too. Catch
// PRF_UNAVAILABLE and instruct: "save the passkey to Google Password Manager"
// (desktop Chrome local-profile passkeys have no PRF).
