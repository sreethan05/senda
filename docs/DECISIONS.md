# Architecture Decisions

## ADR-001 — Next.js PWA instead of React Native
**Decision:** mobile-first Next.js web app (PWA).
**Reason:** the Agora bounty says "mobile app" — a phone-browser web app satisfies the demo while avoiding app-store builds in 8 days. Mera ships a web demo path; PRF passkeys work in Chrome/Edge on Android/desktop. Judges see two phones in a video, not an App Store listing.

## ADR-002 — Mera as the only production account layer
**Decision:** passkey auth via `@category-labs/mera`; burner wallet only behind a dev env flag.
**Reason:** aligns with the Agora bounty ("Mera passkey onboarding") and the Best Mera-Powered UX bounty ("Mera is the entire account layer — no seed phrase, no extension, no custody backend"). Also the product's core moat: onboarding without crypto friction.

## ADR-003 — Escrow + claim link instead of direct transfer
**Decision:** funds route through a `SendEscrow` contract; recipient is unknown at send time and claims via signature bound to a phone hash.
**Reason:** phone-number sending requires holding funds until the recipient proves ownership. Direct transfer can't express "send to a phone number".

## ADR-004 — Supabase as an index, never a custodian
**Decision:** Supabase stores `{escrowId, phoneHash, amount, status}` only.
**Reason:** phone→claim lookup needs off-chain storage; the contract stays the only place funds exist. Keeps SECURITY.md surface small (no keys/PII in DB).

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
