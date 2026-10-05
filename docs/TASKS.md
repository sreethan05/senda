# Tasks

Work ONE task at a time: implement → test → review → commit → mark complete. Target: **working product by Oct 11, video + submission Oct 12, deadline Oct 13.**

> **Strategy deltas from Oct 5 deep research (see PITCH.md):** (1) Position as **settlement RAIL, not retail app** — own Daimo/Nala graveyard in write-up + video. (2) Receipt compares WU *and* "typical app $0-fee/1–3% hidden spread" (TASK-601). (3) **ERC-3009 = sender-side gasless path only** (escrow core stays plain `transferFrom` — TASK-306, deferred). (4) Claim authorization is a **Linkdrop-style ephemeral link key** (32-byte private key in the URL fragment; escrow stores its address; claim sig made by that key — relayer/redirect-proof, sketch v3). (5) Contract **emits 4 events** (indexer + Nansen panel depend on them). (6) Contract guards: SafeERC20, `amount > 0`, `ttl >= 10 min`, `NoEscrow`; frozen/paused AUSD reverts atomically (nothing strands). (7) Ship on vercel.app (valid rpId) — no custom domain; **pick the exact project name before creating demo passkeys**. (8) Demo armor: pinned Mera, non-PRF fallback, backup video, rehearsed on exact devices. **SCOPE ORDER (external review): nothing below Phase 5 gets built until the core loop is green on testnet — ERC-3009, encrypted note, Aurora, Envio, Nansen are all behind that gate.**

## Phase 1: Setup (Day 1 — Oct 4/5)
- [x] TASK-101 Init Next.js + TypeScript + Tailwind in repo
- [x] TASK-102 Configure env handling + `.env.example`, chain constants (143, AUSD address)
- [ ] TASK-103 Deploy placeholder Home screen to Vercel preview
- [ ] TASK-104 Acquire small amount of MON for mainnet gas (no faucet exists — buy/bridge)

## Phase 2: Auth (Day 2 — Oct 5)
- [x] TASK-201 Integrate Mera: passkey creation → derived account
- [x] TASK-202 Login/logout state, protected routes
- [ ] TASK-203 Dev-only burner wallet mode behind env flag
- [ ] TASK-204 Balance display: read AUSD balance of connected account
- [ ] TASK-205 Get test AUSD via testnet faucet (`requestFunds` on `0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C` mints 10,000 AUSD on 10143)

## Phase 3: Contracts (Days 3–4 — Oct 6/7)
- [ ] TASK-301 Foundry init in `contracts/`, point at Monad testnet + mainnet
- [ ] TASK-302 `SendEscrow.sol` (design per RESEARCH_TECH.md §3 + sketch v3): app generates a 32-byte ephemeral **link key** client-side; `depositTo(linkKey, amount, ttl)` pulls AUSD via SafeERC20; `claim(id, payee, sig)` is **relayer-submitted** — requires the **link key's EIP-712 signature** over `Claim(escrowId, payee)` (recover(sig) == stored linkKey); `cancel(id)` sender-only; `reclaim(id)` for expiry. **Emits Deposited/Claimed/Cancelled/Reclaimed.** Guards: `amount > 0`, `ttl >= 10 min`, `linkKey != 0`, `NoEscrow`. Frozen/paused AUSD reverts atomically (nothing strands).
- [ ] TASK-303 Foundry tests: deposit, claim, cancel, double-claim, wrong-signature claim, reentrancy
- [ ] TASK-304 Deploy to testnet 10143, verify, run full manual loop
- [ ] TASK-305 Deploy to mainnet 143, verify, pin address in env
- [ ] TASK-306 (Agora bounty) ERC-3009 gasless sender: `transferWithAuthorization` (EIP-712 domain "Agora Dollar") so the sender needs no MON — or a dedicated demo beat if full path is heavy
- [ ] TASK-307 Threat-model page + Slither/Aderyn triaged report + Foundry suite per RESEARCH_TECH §8 (unit incl. expiry-boundary, fuzz, solvency invariant, mainnet-fork signature-parity test **+ `fork_Claim_RevertsWhenFrozen_Mock`**)

## Phase 4: Send flow (Day 5 — Oct 8)
- [ ] TASK-401 Amount input + phone input (E.164 validation, NGN preview)
- [ ] TASK-402 Approve + deposit transaction flow (pending → success + explorer link → error)
- [ ] TASK-403 Server route: store `{escrowId, keyHash, amount, status}` in Supabase (keyHash = keccak256 of the link key — the only lookup key anon can use)
- [ ] TASK-404 Generate claim link (`/claim/[id]#k=<linkKey hex>`) + WhatsApp/SMS share deep link — the link key's private half lives ONLY in the fragment

## Phase 5: Claim flow (Day 6 — Oct 9)
- [ ] TASK-501 Claim landing page from link (amount, sender, big claim button)
- [ ] TASK-502 Passkey creation at claim time (Mera) for brand-new recipients
- [ ] TASK-503 Claim flow (relayer-submitted — recipient has zero MON): claim page from link (reads link key from fragment) → Mera passkey creates payee account → app signs `Claim(escrowId, payee)` WITH THE LINK KEY client-side (@noble/secp256k1, no gas) → POST /api/claim → **server relayer wallet** submits `claim(id, payee, sig)` → receipt screen (settlement time, fee, comparison)
- [ ] TASK-504 Sender cancel flow + refund receipt
- [ ] TASK-505 History list with status chips
- [ ] TASK-506 (Mera bounty) Encrypted remittance note: memo sealed with PRF-derived AES-256-GCM key (Secret Vault format), decryptable only by recipient's passkey; per-corridor salt namespacing (`senda:US->NG`)

## Phase 6: Demo polish (Day 7 — Oct 10)
- [ ] TASK-601 Receipt comparison: WU 4–9% + "typical app: $0 fee, 1–3% hidden spread" vs senda $0.01 — position as *verifiable on-chain* (see RESEARCH_MARKET.md §4)
- [ ] TASK-602 NGN conversion display on every amount
- [ ] TASK-603 Empty/loading/error states pass across all screens
- [ ] TASK-604 PWA manifest + icon + name polish ("senda" lowercase branding)
- [ ] TASK-605 (stretch) Envio indexer consuming the four contract events (Deposited/Claimed/Cancelled/Reclaimed) for instant history — doubles as the "Best Use of Envio" bounty entry
- [ ] TASK-606 (stretch) Aurora/NEAR Intents "add funds from any chain" button

## Phase 7: Demo + submission (Days 8–9 — Oct 11/12)
- [ ] TASK-701 Write 90-second demo script (two phones + stopwatch + WU comparison)
- [ ] TASK-702 Record video (plus backup lossless take of every critical path — scrcpy two-phone rig, Screenity, Clipchamp auto-captions per PITCH.md §7). **Reclaim beat:** deposit a second escrow with ttl=10 min at session start, jump-cut with a "+10 min" timestamp overlay, then call reclaim() live — MIN_TTL stays 10 min in the real contract; no demo build with altered constants.
- [ ] TASK-703 Write project profile: demo, write-up (problem/moat/why-Monad), code link
- [ ] TASK-704 Fill bounty fields: Agora, Mera UX (+ Aurora if integrated)
- [ ] TASK-705 Submit by Oct 12 EOD — never Oct 13 night
