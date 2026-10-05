# Technical Research (Phase-Prep Deep Reads)

Verified against official docs + live on-chain calls, Oct 4 2026. This file is the build-time source of truth. Strategy/market research lives in the hackathon-research notes; this file is implementation.

---

## 1. Mera (`@category-labs/mera@0.2.0` — pin exactly)

Sources: mera.category.xyz (all pages), github.com/category-labs/mera (source + demos read), docs.monad.xyz/guides/mera, npm registry.

### Verified API
> Working reference code: [research/mera-auth-pattern.tsx](research/mera-auth-pattern.tsx) — create/login/derive/sign flow used by Phase 2.
```ts
import {
  createPasskeyWithPrfOutput,   // create: { rp: {id,name}, user: {name, displayName}, prfSalt? }
  getPasskeyPrfOutput,          // login:  { rpId, credential?, prfSalt? } → { credentialId, prfOutput }
  createSecp256k1SigningSession,// { privateKey: 32B } → session (signDigest, publicKey, end())
  getEvmAddress,                // (publicKey 65B) → "0x…" checksummed
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";  // viem ≥2.28; NO ethers adapter exists
```
- **Derived account is a plain EOA.** PRF output → BIP-39 24-word mnemonic → BIP-32 `m/44'/60'/0'/0/{index}` → secp256k1 key. Standard low-S ECDSA signatures. **Consequence: escrow verifies claims with plain `ecrecover` over EIP-712 — no ERC-1271, no P-256 precompile.**
- **Free recovery path:** the derived mnemonic imports into MetaMask and reproduces the identical address.
- One passkey → many keys: different `prfSalt` = different namespace; or same PRF output + BIP-44 index.
- Login persistence: store `{credentialId, transports}` in localStorage at create; pass back as `credential` to `getPasskeyPrfOutput`. Cache only `{address, credentialId}` for "locked" UI on reload; re-derive on ceremony; verify re-derived address matches cached (demos show "That passkey opens a different account" error otherwise).
- viem integration: `createWalletClient({ account: toViemAccount(session), chain: monad, transport: http(RPC) })` — `monad` (143) and `monadTestnet` (10143) ship in viem/chains. Session supports signMessage/signTypedData/signTransaction; all silent after unlock.

### Constraints & risks
- **rpId is forever** — bound to registrable domain; changing domain loses accounts (mnemonic is the only recovery). Decide deploy domain BEFORE demo accounts are created. Localhost dev passkeys ≠ production passkeys.
- **PRF browser matrix:** Google Password Manager (Chrome Android ✓; Chrome 132+ desktop signed-in ✓), iCloud Keychain (Safari iOS 18+/macOS 15+), 1Password, Windows Hello (Edge / Win11 25H2+). **Desktop Chrome may create a local-profile passkey with NO PRF → `PRF_UNAVAILABLE`** — catch this error and instruct user (choose "save to Google Password Manager"). Demo browser: Chrome on Android. Firefox: no.
- Node `>=24` required (we have 24.14.1 ✓). Vercel functions runtime must be Node 24 — set `engines` / framework preset accordingly.
- Cancellation is indistinguishable from failure (`PASSKEY_OPERATION_FAILED`); `.message` is not a stable contract — switch on `.code` only.
- Browser-only: import only inside `"use client"` modules / dynamic import on click. Docs have zero SSR guidance.
- No gas sponsorship/bundler anywhere — senders need MON gas; recipients are gasless via our push model.
- **Monad quirk: gas charged = declared gasLimit, not gas used.** Always pass explicit, tight `gas` (viem estimates from RPC). Never use MetaMask-style "bump the limit" fallbacks.

### Remaining verified details (completeness addendum)
- `session.signDigest(digest32)` does **not** prehash — pass the exact 32-byte keccak digest yourself; returns `{compact (64B r||s, low-S), recovery: 0|1}`. `session.end()` permanently zeroes the key copy — call on sign-out (supports `using`/`Symbol.dispose`).
- Full `MeraErrorCode` union: `PASSKEY_OPERATION_FAILED` (includes user cancel), `CRYPTO_UNAVAILABLE`, `PRF_UNAVAILABLE`, `SESSION_ENDED`, `DECRYPT_FAILED`, `INPUT_INVALID`, `VAULT_FORMAT_INVALID`.
- Overwrite hazard: re-creating a credential with the same rpId + same user handle destroys the old keypair AND its PRF permanently. Mera generates a fresh random `user.id` per create call, so double-create always *adds* a passkey — but never re-create for the same user handle.
- Future paths verified: `signAuthorization` (EIP-7702) works via the viem account — delegation to a smart account without changing the passkey flow. Secret-vault API exists (`createSecretVaultWithNewPasskey` etc., AES-256-GCM) — unused by senda v1. React Native path exists (iOS 18+/Android 9+, `react-native-passkey` 3.6.1) — unused, we're PWA.

---

## 2. AUSD (Agora Dollar) — live-verified on Monad

Sources: docs.agora.finance (all dev pages), github.com/agora-finance/agora-dollar-evm (IAgoraDollar.sol), live `eth_call` against rpc.monad.xyz + testnet-rpc.monad.xyz.

| Item | Value |
|---|---|
| Mainnet token | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` — name `AUSD`, decimals 6, supply ~146.8M |
| Testnet token | `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` |
| **Testnet faucet** | **`0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C` — `requestFunds(address)` mints 10,000 AUSD** |
| Interfaces | ERC-20 + ERC-2612 permit + ERC-3009 (`transferWithAuthorization` verified live) + ERC-1271 |
| EIP-712 domain | `{ name: "Agora Dollar", version: "1", chainId: 143, verifyingContract: <token> }` — name is "Agora Dollar", NOT "AUSD" (matters only if we add permit/3009) |
| Native USDC (mainnet) | `0x754704bc059f8c67012fed69bc8a327a5aafb603` |

### Escrow transfer pattern (all verified standard)
```
approve(escrow, amount)            // no increaseAllowance exists → approve exact per send (or Max once)
escrow: transferFrom(sender, self, amount)
escrow: transfer(claimant, amount)
```
- Reverts arrive as **custom errors**: `ERC20InsufficientAllowance`, `ERC20InsufficientBalance`, `ERC20InvalidReceiver`, `AccountIsFrozen(address)`, `ZeroAmount` (zero-value calls revert!). Decode with viem `decodeErrorResult` + IAgoraDollar ABI; also handle `bool false` defensively.
- Compliance powers exist (Freezer per-account, Pauser global) — currently off. UI should pre-check `isAccountFrozen()` / `isTransferPaused()` view calls where cheap; escrow must always keep a refund path so nothing can strand.
- **Skip ERC-3009 in v1** (would need a relayer; recipients are already gasless via push). Everything mapped for a later ~1-day add: domain `{name: "Agora Dollar", version: "1", chainId, verifyingContract}`, canonical typehashes (`TRANSFER_WITH_AUTHORIZATION 0x7c7c6cdb…`, `RECEIVE_WITH_AUTHORIZATION 0xd099cc98…`), selector `0xe3ee160e`, `nonces(address)` for the nonce.
- **Upgradeability:** AUSD is an EIP-1967 transparent proxy — Admin can change implementation behavior without notice. Don't hardcode assumptions beyond the verified interface; re-check after any announced upgrade.
- Balances are `uint248`; **no fee-on-transfer** (Transfer event carries full value); token address dispatches transfer/transferFrom/3009 natively and delegatecalls the rest through fallback — use the repo's ABI, not explorer auto-detection.
- **Demo funding:** swap USDC → AUSD on Uniswap V4 (Monad) or Curve; AUSD/MON pool is thin. Kraken lists AUSD/USD (verify Monad withdrawals before demo day).
- **Testnet-first:** full loop can be rehearsed on 10143 with faucet AUSD before touching mainnet.

---

## 2b. AUSD architecture facts (cross-check Oct 5 — Aave assessment + Agora docs)

AUSD on Monad is a **LayerZero V2 OFT**: bridging is burn-and-mint via an OFT adapter, the token is **issuer-controlled and permissioned**, and the proxy is **EIP-1967 upgradeable**. Confirmed surfaces: `isAccountFrozen(address)` (Freezer role), global pauses (`isTransferPaused()` etc.), custom errors (`AccountIsFrozen`, `ZeroAmount`, OZ-style `ERC20InsufficientAllowance/Balance/Receiver`).

**First-class states for TEST_PLAN + UI (not afterthoughts):**
1. **Frozen claimant at claim time** → claim tx reverts atomically; escrow state rolls back; funds stay claimable. UI decodes to "issuer temporarily blocked this transfer — try again shortly" + sender cancel + expiry reclaim as the two escape hatches.
2. **Transfer paused mid-flow** → same atomic-revert story for deposit/claim/cancel/reclaim; nothing strands.
3. Fork-test both branches (`fork_Claim_RevertsWhenFrozen_Mock`). This IS the answer to the judge question *"what if Agora freezes a claimant?"* — "atomic revert + three refund paths; here's the test."

## 2c. Nigeria off-ramp refresh (Oct 5 cross-check)
Partner-model direction stands; specifics updated: **CBN opened a VASP regulatory sandbox in Aug 2026** and is building the licensing regime under **Payments System Vision 2028**, which treats fiat-backed stablecoins as monetary instruments with reserve-custody and "RegTech node" requirements. **cNGN** (SEC-authorized naira stablecoin) + the CBN sandbox belong in the production path named alongside Yellow Card/Busha/Quidax — more current, more judge-impressive. Busha API remains the closest integration option; Mercuryo still does not settle NGN.

## 3. SendEscrow + claim-link design (prior art: Linkdrop P2P, Umbra)

Nobody cryptographically binds claims to phone numbers — phones hold no keys. Industry pattern = **knowledge of an out-of-band secret + claimant signature**. SMS OTP (Twilio ~$0.05/verification, trial can only text pre-verified numbers) is rejected: cost + demo risk + it's off-chain theater anyway.

### Locked design (two-factor, zero backend)
- Sender's app generates a **6-digit claim code** + salt; stores `codeHash = keccak(code)` and `phoneHash = keccak(phone ‖ salt)` on-chain; salt+code travel in the claim link ("SMS" is simulated by opening the link on phone 2).
- `claim(id, code, sig)`: contract checks `keccak(code) == codeHash` **and** recovers an EIP-712 `Claim(uint256 escrowId, bytes32 codeHash, address payee)` signature where **recovered == msg.sender == payee**.
- Front-running is fund-neutral (sig binds payee — a copied claim tx reverts `BadSignature` for anyone else). Replay is blocked by single-use flag + escrowId-in-typehash + EIP-712 domain (chainId+contract). Use OZ `ECDSA`/`MessageHashUtils` (rejects high-S/malleable sigs).
- `expiresAt` + permissionless `reclaim()` so funds can never strand; `cancel()` sender-only.
- Known, documented limitations: `phoneHash` is brute-forceable if the salt leaks (salt lives in the link only — fine at demo scale; real product would use a server-signed phone attestation, cleanly upgradeable later); a forwarded link = handing someone cash (possession of the secret is the design, same as Linkdrop).
- Demo tip: set `ttl` ≈ 10 minutes for the live demo so an expired-escrow `reclaim` can be shown on camera.
- Full contract sketch: [research/SendEscrow-sketch.sol](research/SendEscrow-sketch.sol) — feeds TASK-302 directly. Custom errors only. Reverts pay full declared gas on Monad — keep tests aware.

---

## 4. Foundry on Monad

- **Foundry ≥ v1.8.0 required** (Monad execution rules). Template: `forge init --template monad-developers/foundry-monad`.
- `foundry.toml`: `network = "monad"`, `eth_rpc_url = "https://testnet-rpc.monad.xyz"`, `chain_id = 10143` (testnet profile; mainnet = 143 / `https://rpc.monad.xyz`). Verification metadata: `metadata = true`, `metadata_hash = "none"`, `use_literal_content = true`.
- Deploy via keystore: `cast wallet import monad-deployer --private-key $KEY` → `forge script script/Deploy.s.sol --rpc-url ... --broadcast` (forge **script** is more reliable than `forge create` on Monad per community reports).
- Verify (no API key): `forge verify-contract <ADDR> src/SendEscrow.sol:SendEscrow --chain 10143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/`
- Testnet MON faucet: `faucet.monad.xyz` (chain 10143). Mainnet MON: buy/bridge (no faucet exists).

---

## 5. Infra — verified current limits & setup

### Supabase (free tier)
- 2 active projects, 500 MB DB, 50K MAU. **Free projects pause after 7 days inactivity** — irrelevant during the 8-day sprint; poke it weekly after.
- New key scheme: `sb_publishable_…` (client, respects RLS) / `sb_secret_…` (server-only, bypasses RLS). `.env`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (never `NEXT_PUBLIC_`).
- `claims` table SQL + RLS: statuses `pending|claimed|cancelled`, indexes on phone_hash/status, **no anon INSERT/UPDATE/DELETE**, anon reads only through a `security definer` RPC `get_claim_by_escrow(p_escrow_id)` — exact SQL: [research/claims-table.sql](research/claims-table.sql) (run at TASK-403).

### Vercel (Hobby)
- 100 deploys/day, 100 GB transfer, 1M function invocations. **Fair-use policy explicitly allows this use** (no contest language; demo must stay fee-free/ad-free — it is).
- `NEXT_PUBLIC_*` vars are inlined at **build time** — set before first build, redeploy on every change. Server-only `SUPABASE_SECRET_KEY` reads at runtime in route handlers. Push to `main` = production; branches = preview URLs (use preview for rehearsal).

### NGN rate
- **`https://open.er-api.com/v6/latest/USD`** — no key, NGN included (verified live: 1 USD = 1330.14 NGN, Oct 4 2026), hourly-cached from a server route (`next: { revalidate: 3600 }`) + hardcoded fallback `1330` for demo day. Frankfurter has no NGN (rejected); Chainlink NGN feed exists only on Celo (rejected).

### Share links
- WhatsApp: `https://wa.me/?text=<encodeURIComponent(msg)>` (no number → contact picker). SMS: `sms:?&body=<…>` (hybrid syntax works iOS + Android). Prefer `navigator.share()` first, anchors as fallback. Always `encodeURIComponent` — `&` in the claim URL truncates SMS bodies otherwise.

### Tooling
- Playwright: chromium-only (~100–140 MB) or `channel: 'msedge'` (zero download). 3–5 smoke tests against the Vercel preview URL. ESLint 9 flat config; `next lint` is removed in Next 16 — our `"lint": "eslint"` script is already correct.

---

## 6. Decisions locked by this research
| # | Decision | Why |
|---|---|---|
| D1 | `ecrecover` over EIP-712 in SendEscrow | Mera accounts are plain EOAs (low-S secp256k1) |
| D2 | 6-digit claim code (codeHash) + claimant sig | Two-factor claim, $0, no Twilio, front-run neutral |
| D3 | Skip ERC-3009 in v1 → **REVISED Oct 5: promoted to TASK-306** (Agora's own mechanism, sponsor-recognizable; see PITCH.md §3) | — |
| D4 | Testnet-first full loop (faucet AUSD = 10k/call) | Free rehearsal before mainnet demo |
| D5 | `open.er-api.com` for NGN | No key, NGN live, cacheable |
| D6 | Supabase RPC-read instead of blanket SELECT policy | No table enumeration by anon |
| D7 | Pin `@category-labs/mera@0.2.0`, viem-only stack | Preview lib, no ethers adapter exists |

## 7. Aurora Intents (stretch bounty $5K — only if main demo frozen by day 6)
- **Widget-first:** `@aurora-is-near/intents-swap-widget` (or `-standalone`), lock `allowedTargetChainsList: ['monad']`, `sendAddress` = user's Monad address. Docs: docs.intents.aurora.dev; keys self-serve at studio.aurora.dev (no approval). Intents Deposits PDA API (`https://intents-api.aurora.dev/api/`, appKey in path) = "your dedicated Monad deposit address" UX (~1 extra day).
- **Live-verified Oct 5:** /v0/tokens returns Monad with exactly 3 assets (MON, USDT0, USDC `0x7547…`) — **AUSD is NOT an output**; fund USDC → swap to AUSD in-app (Kuru/Agora rails). ⚠️ Monad pairs were "not available" for quoting unauthenticated post-exploit — verify with a real Studio key BEFORE committing to the stretch. **No testnet exists** — rehearse with ~$10 mainnet.
- Demo story for Aurora: chainless funding (show Base/Solana source), Shield Incident API gating (we read the incident report), PDA sticky address. Prize is $5K **split across 3 winners**.

## 8. Security test matrix (feeds TASK-307; full checklist from research)
- Unit (~19): deposit happy/zero/insufficient-allowance/ttl-min; claim happy/wrong-code/stolen-sig/malleated-sig/replay-other-escrow/after-expiry/**exact-expiry-boundary**/double-claim/wrong-codeHash-in-sig; cancel only-sender/after-claim; reclaim only-after-expiry/twice; reentrant-mock-token; fee-on-transfer assumption doc.
- Fuzz (3): deposit-claim round trip; no-claim-without-valid-sig; wrong-code-never-claims.
- Invariants (3, handler-based): `invariant_Solvency_BalanceGeEscrowedTotal` (>= — donation-safe), `invariant_NoDoublePayout` (per-id state machine, terminal states sticky), `invariant_SenderNeverLosesMoreThanDeposited`.
- Fork (2): raw AUSD 6-decimal behavior on Monad testnet fork; **frontend-derived-signature parity test** (produces the EIP-712 digest exactly as the Next.js client does — catches domain name/version/chainId mismatches, the #1 integration bug).
- Static analysis: Slither + Aderyn, triaged report shipped with submission (fix: SafeERC20, amount>0, ttl-min; triage-with-justification: events-in-loop false positive, centralization-by-design on cancel).
- Frontend: claim code in **URL fragment only** (never transmitted to server — RFC 9110 §7.3; query strings are logged), rate-limited claim lookup, RLS on every table, pinned deps + npm audit.
