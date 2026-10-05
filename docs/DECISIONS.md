# Architecture Decisions

## ADR-001 — Next.js PWA instead of React Native
**Decision:** mobile-first Next.js web app (PWA).
**Reason:** the Agora bounty says "mobile app" — a phone-browser web app satisfies the demo while avoiding app-store builds in 8 days. Mera ships a web demo path; PRF passkeys work in Chrome/Edge on Android/desktop. Judges see two phones in a video, not an App Store listing.

## ADR-002 — Mera as the only production account layer
**Decision:** passkey auth via `@category-labs/mera`; burner wallet only behind a dev env flag.
**Reason:** aligns with the Agora bounty ("Mera passkey onboarding") and the Best Mera-Powered UX bounty ("Mera is the entire account layer — no seed phrase, no extension, no custody backend"). Also the product's core moat: onboarding without crypto friction.

## ADR-003 — Escrow + claim link instead of direct transfer *(amended — mechanism superseded by ADR-013)*
**Decision:** funds route through a `SendEscrow` contract; recipient is unknown at send time and claims via an authorization delivered out-of-band.
**Reason:** phone-number sending requires holding funds until the recipient proves entitlement to the link. Direct transfer can't express "send to a phone number".

## ADR-004 — Supabase as an index, never a custodian *(amended — lookup key changed by ADR-013)*
**Decision:** Supabase stores `{escrowId, keyHash, amount, status}` only.
**Reason:** claim lookup needs off-chain storage; the contract stays the only place funds exist. Keeps SECURITY.md surface small (no keys/PII in DB).

## ADR-005 — Foundry for contracts
**Decision:** Foundry, not Hardhat.
**Reason:** fastest test loop, first-class Monad support in docs, solid fuzzing for the signature-bound claim logic.

## ADR-006 — Demo corridor: US → Nigeria
**Decision:** demo the US→Nigeria corridor with NGN display.
**Reason:** highest-contrast fee story (8% average, 14.5% via banks vs ~$0.01). The receipt comparison slide is the emotional peak of the demo video.

## ADR-007 — Aurora Intents is a stretch phase, not MVP
**Decision:** Phase 6 stretch task; bounty fields filled at submission only if integrated.
**Reason:** NEAR Intents was exploited ~Sept 30 and patched Oct 2, 2026 — fresh infra + 8-day window = integration risk not worth blocking the core loop. The MVP is complete without it.

## ADR-008 — AUSD only (no multi-stablecoin)
**Decision:** support AUSD exclusively in v1.
**Reason:** the bounty specifies AUSD; it's live on Monad with ERC-3009 gasless transfer support; one token = one integration tested well.

## ADR-009 — Claim authorization design *(SUPERSEDED by ADR-013)*
**~~Decision:** escrow stores `codeHash`; claim link carries the code; `claim()` requires `keccak(code) == codeHash` AND an EIP-712 signature where recovered == msg.sender == payee. No SMS provider.~~
**Superseded:** the 6-digit codeHash was brute-forceable (10⁶ off-chain guesses → attacker becomes a legitimate claimant), and `recovered == msg.sender == payee` meant a fresh recipient (zero MON) could never claim. See ADR-013.

## ADR-013 — Linkdrop-style ephemeral link key (current design)
**Decision:** the sender's app generates a 32-byte **ephemeral link key** client-side; the escrow stores its **address**; the link fragment holds the **private key**. `claim(id, payee, sig)` is **relayer-submitted** (server wallet pays gas; recipient needs zero MON) and requires the **link key's EIP-712 signature** over `Claim(escrowId, payee)` — recover(sig) == stored linkKey. The recipient's Mera passkey account is the payee.
**Reason:** closes both flaws found in review (confirmed independently by a second external review): (1) no shared secret ever reaches calldata, so neither the relayer nor a mempool watcher can redirect funds (forgery requires the key); (2) the recipient is genuinely gasless. Possession of the link = ownership (documented cash analogy). Proven pattern: Linkdrop P2P. Client-side signing via `@noble/secp256k1` — the passkey account is the destination, the link key is the authorization.
**Alternatives rejected:** *v2 shared-secret relayer* — the relayer learns the secret from its own calldata and can redirect (fatal). *Gas-drip + recipient self-submit* (review #2's recommendation) — removes the redirect vector but keeps a reveal race (the recipient's own claim still broadcasts the authorization first) and adds a drip-abuse surface. *Private-mempool submission* — unnecessary under v3: the link key is never broadcast at all.

## ADR-010 — Contract verifies with plain `ecrecover` (no ERC-1271 / P-256 precompile)
**Decision:** SendEscrow uses OZ ECDSA.recover over an EIP-712 digest.
**Reason:** verified against Mera source — derived accounts are standard secp256k1 EOAs (PRF → BIP-39 → m/44'/60'/0'/0/0). The P-256 precompile exists on Monad but is unnecessary here; noted as future work if we add smart accounts.

## ADR-011 — Testnet-first loop, mainnet only for the demo take
**Decision:** build and rehearse the full send→claim loop on Monad testnet (10143) using the AUSD faucet (`requestFunds` mints 10,000 AUSD), then deploy to mainnet (143) for the recorded demo.
**Reason:** free, unlimited rehearsal of the exact demo path; mainnet tx count and gas spend stay minimal; the EIP-712 domain pins chainId so nothing cross-replays.

## ADR-012 — NGN rate via open.er-api.com, hourly server cache
**Decision:** server route fetches `https://open.er-api.com/v6/latest/USD` with `revalidate: 3600`; fallback constant 1330 if fetch fails.
**Reason:** no API key, NGN supported (verified live), Frankfurter lacks NGN, no Monad-native NGN feed exists.
