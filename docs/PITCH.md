# PITCH — Master Strategy (research synthesis, Oct 5 2026)

Distilled from 10 research agents: judges, sponsors, UX, branding/domain/demo, off-ramp/compliance, unit economics, competition intel, security prep, Aurora integration, and a judge's stress-test. Sources cited in RESEARCH_MARKET.md / RESEARCH_TECH.md; judge quotes in the research notes.

---

## 1. Positioning: RAIL, not retail app

**Tagline:** *senda — instant claimable-AUSD settlement rails.*

**The wedge in one sentence:** *"The same UX the whole industry is converging on — phone-number claim links, passkey onboarding — on the chain that makes it instant and with the asset the bounty sponsor issues."*

**The graveyard is bigger than Daimo.** Pre-empt ALL of it by name in the write-up: Daimo (killed retail → B2B rails), Beam (acquired, wound down), Valora (team → Stripe), **AutoPayKe** (live phone-number + escrow + claim-link remittances in Kenya/Ghana/Uganda — proof the *pattern* works, on chains without Monad's speed or an AUSD-like sponsor asset), AllScale Claim Link, Coinbase Wallet claim links, MiniPay Cash Links. Every one of them validates the mechanics; none has Monad's finality, an issuer-aligned stablecoin, or passkey-only onboarding via Mera. The market's own verdict: **the rails win, the retail wrappers die** — so senda is the rail.

**Fee comparison screen shows three rows:** WU (~4–9%) for contrast → "typical app: $0 fee, 1–3% hidden spread" (LemFi/Nala/Afriex) → **senda: $0.01, every number verifiable on-chain.** **The emotional beat is verifiability, not price** — "cheaper than WU" is table stakes now; show the on-chain rate path, fee, and settlement timestamp where the incumbents show a black box.

## 2. The judge panel — 5 themes everyone shares

1. **Stablecoins as settlement rails** — Galaxy ($1T by 2030 forecast), Castle Island co-wrote *Stablecoins: The Emerging Market Story* (dollarization/remittances — literally our thesis), Dragonfly's portfolio has **Agora AND Afriex**, IOSG published an Asia stablecoin-payments thesis, Pantera backs Rain/Coinflow, Paradigm led Monad's round AND built Tempo with Stripe.
2. **Hide the chain, win the first five minutes** — the track brief's own words; Eunice Giarta's podcast is literally "TPS Is a Lie — performance as UX."
3. **Remittances are the canonical use case** — every firm above has published on it.
4. **Passkey-native, seedless onboarding** — track example + Mera/Privy/Dynamic bounties.
5. **Verified shipping** — Tina Qi ("relentlessly ship"), Maria Shen (developer-data thesis), judges verify the build window.

**Three sentences to say/write (memorize):**
1. "senda is a payments app that never mentions blockchain — built around the user's first five minutes, settling on Monad's sub-second blocks, with passkey-native accounts: no seed phrase, one tap."
2. "senda is cryptodollarization productized — the exact use Castle Island/Visa/Artemis found dominates emerging-market stablecoin activity."
3. "Every metric here is on-chain and verifiable — via Nansen, if you like." (Alex Svanevik is a judge; Nansen is a sponsor.)

Compliance-forward line for Ajit Tripathi: demo = no licensed activity; production = licensed-partner model (US MTL partner + SEC-Nigeria VASP off-ramp), 1% excise tax doesn't apply to self-directed wallet-to-wallet transfer (§4475 taxes cash-funded provider-mediated transfers — proposed regs Apr 13 2026).

## 3. Bounty rubric checklist (give sponsors their bullets back)

**Agora ($10K, "Best Cross-Border Payments App"):**
- [ ] Installable **PWA** with native splash/install prompt — argue "installable mobile app, zero App-Store friction, which is the point for remittances"
- [ ] Real **AUSD** moving across the corridor, mainnet
- [ ] **ERC-3009 gasless sender** (`transferWithAuthorization`, domain "Agora Dollar") — their signature mechanism; almost nobody uses it
- [ ] Quote **Agora Instant Settlement** (AUSD/USDC pair live on Monad) in the write-up as the production FX leg — name-drop OCC charter (Sept 21 2026), VanEck/State Street, $184M AUSD-on-Monad (+462%/90d)

**Mera ($2.5K UX + $2.5K "One Passkey, Many Keys"):**
- [ ] Mera as the entire account layer, visibly: 2-click onboarding → 5 transactions with ZERO extra prompts (signing session) → same account restored on a second device, on camera
- [ ] **Encrypted remittance note**: memo sealed with a PRF-derived AES-256-GCM key (Mera Secret Vault format) so only the recipient's passkey can decrypt — a creative *non-wallet* PRF use inside a payments product. Double-bounty bait.
- [ ] Per-corridor salt namespacing (`senda:US->NG`) as the "many keys" story

**Aurora ($5K, stretch — only if main demo frozen by day 6):** widget `@aurora-is-near/intents-swap-widget` locked to Monad, PDA "your dedicated Monad deposit address", USDC-then-swap-to-AUSD, Shield-incident-gated deposits (judge-impressing "we read the incident report" touch). Keys self-serve at studio.aurora.dev. ⚠️ Monad pairs were not quotable unauthenticated on Oct 5 (post-exploit) — verify with a real key FIRST; $5K is split across 3 winners; no testnet.

**Cheap adjacency (add to submission's bounty section, ~1–3h each):**
- **Nansen ($5K):** surface the "every metric verifiable on-chain" claim through Nansen's API/label data — even a wallet-labels panel counts as "best use of Nansen".
- **Envio ($1K):** the stretch indexer (TASK-605) already qualifies as "Best Use of Envio" if HyperIndex powers the history feed.
- **Community ($5K):** the build-in-public cadence (§3 bottom) done deliberately.
- **Alchemy ($1K credits):** route the app's RPC through Alchemy if supported — config-level effort.

**Community ($5K):** build in public 2–3×/week — tag @monad_dev, @keoneHD, @withAUSD, @category_xyz, @mveehkim; phrase "Metropolis hackathon" + #Monad; cross-post LinkedIn (Monad amplifies there). Makes the Community Team bounty directly monetizable.

## 4. Competitive field (honest)

- ~**300–600 submissions** estimated (1,500+ builders registered — single source; ETHGlobal conversion rates 20–35%).
- Finance track most crowded (Monad = "Home of High-Frequency Finance" + trading sponsors). Consumer moderate. **Remittance niche: one known public competitor** — "WeMadeIt" (AUSD group-pots app, Agora bounty demo on YouTube). Not a corridor product.
- ~38 winnable slots (12 track + champion + ~25 bounties). Any-prize odds ≈ 10% — bounties are the EV: named, narrow, judgeable.
- **Submit Oct 10–11.** Early submission buys no judge attention (judging starts Oct 14) but eliminates portal-congestion risk.

## 5. The seed story (if a judge asks "is this a company?")

Remitly earns **~$188/active-customer/year at 60–66% gross margin** charging ~3%. senda: ~1% embedded FX + ~1% float carry (users keep ~3% via AUSD yield) → same P&L at a fraction of the price, because the float is on-chain and the yield goes to the user. Comparables: Nala raised $40M at >$200M valuation (500K users first), LemFi $53M Series B, Conduit $36M (Dragonfly), Beam $40M exit, Agora $50M (Paradigm-led — the judges own this stack). Seed line: *"$1M pre-seed → 3 corridors, 1,000 monthly senders, $250K/mo volume, $500K AUSD float in 12 months."*

**Demo closing line:** *"Remitly earns $188 a year per customer by charging 3% to move money in three days. senda moves it in three seconds, charges nothing, and pays users to hold it — because on Monad, the float is on-chain and the yield goes to the user, not the middleman."*

## 6. Off-ramp, on-ramp + compliance (judge Q&A, pre-answered)

- **On-ramp (the gap reviewers flagged — sender "doesn't use crypto" but needs AUSD + MON):** demo answer = testnet faucets + pre-funded demo wallets (honest: "on-ramp is a partner function, here's the production path"). Production = US bank/card → AUSD via an on-ramp partner (**Mercuryo — a Metropolis sponsor — covers USD on-ramp**; Ramp Network is the other name), plus **any-chain funding via Aurora Intents** (the stretch — it IS the on-ramp story). Sender MON in production = paymaster/relayer (same relayer infra as the claim).
- **Off-ramp line:** "Recipient taps 'Sell to Naira' in a licensed Nigerian VASP — Yellow Card, Busha, or Quidax — minutes, ~1% all-in. Busha and Yellow Card both expose APIs; production chains the quote onto claim redemption." Mock = signed **payout-order artifact** (honest handoff, not a silent fake naira screen). Mercuryo gotcha: their off-ramp settles EUR/USD/GBP only — that's why the naira gap is the interesting problem. Production path also names **CBN's VASP sandbox (Aug 2026), Payments System Vision 2028, and cNGN**.
- **Money transmission:** demo performs none (no fees/users/value); production = partner model (US MTL $250–435K across 49 states — hence partner-first), Nigeria leg via SEC-licensed VASP with BVN/NIN KYC.
- **1% excise tax:** not applicable to self-directed wallet-to-wallet stablecoin transfer (§4475 covers **cash/money-order/cashier's-check-funded** provider-mediated transfers — bank-funded transfers are excluded too; proposed regs Apr 13 2026). Forbes: the tax is *pushing cash-funded flows onto stablecoin rails*.
- **Disclaimer** (demo app footer + write-up): "Demo only. Not a licensed money transmitter. Production requires FinCEN MSB registration + state MTLs or a licensed partner, and an SEC(Nigeria)-licensed VASP off-ramp with BVN/NIN KYC, OFAC screening, and Travel Rule compliance."

## 7. Demo video (due Oct 11-12) — production plan

- **Structure (75–90s, 5 beats):** 0–8s hook (WU fee receipt) → 8–15s "senda" name → 15–55s live two-phone demo (sender passkey send → receiver buzzes in seconds → on-chain confirmation flash) → 55–70s one graphic (Mera → Monad → recipient) → 70–85s close: URL + closing line + logo hold.
- **Rig:** two Android phones mirrored via `scrcpy` side-by-side (`winget install scrcpy`, `--record` per phone), captured with **Screenity** (free Chrome ext), edited in **Clipchamp** (free auto-captions — CapCut captions are now paywalled). Burned-in captions mandatory (judges watch muted). One hero shot of real phones for the opening 5s.
- **Reclaim beat ("nothing can strand"):** deposit a second escrow with ttl=10 min at session start; jump-cut with a "+10 min" timestamp overlay; call `reclaim()` live. MIN_TTL stays 10 min in the shipped contract — no altered-constants demo build. This beat proves the expiry refund competitors (who auto-refund off-chain) can't show.
- **Script written before code is finalized** (per the guide); record 3–4 takes per action; backup lossless take of every critical path.
- Domain: ship on `senda-*.vercel.app` (vercel.app is on the Public Suffix List → valid passkey rpId). All senda.* domains taken; buy the brand post-hackathon.

## 8. Design system (researched, replaces guesswork)

Font: **Inter** (UI/amounts, tabular-nums) + **Plus Jakarta Sans 700/800** (headings/brand). Icons: **Lucide** (matches Inter's grid). Wordmark: typed lowercase "senda", no AI logo slop. Colors: one green (#10B981) as THE action/success color; warm neutral surface; red/green reserved for financial semantics only. Wise-pattern rules: the **same 4-line cost block** (you send / fee / rate / they get) at every reconsideration point; fee is its own line item, never baked in; custom numeric keypad (no OS keyboard); "they get ₦…" reciprocity updates per keystroke; claim flow reveals sender+amount BEFORE any signup wall (FIDO: passkey prompt after the value moment); success = one celebratory element, CTA = "Send money". Mobile-web polyfills: 100dvh, safe-area calc, 16px inputs, touch-action manipulation, 48px targets, inputmode, standalone manifest.

## 9. Security posture (for the write-up + ack3 scan)

Ship: threat-model page (actors, trust boundaries, EIP-712 flow), Slither+Aderyn triaged report, Foundry suite (~25 unit + 3 fuzz + 3 invariants incl. `balance >= sum(unclaimed)` solvency + 2 mainnet-fork tests incl. frontend-signature parity — catches EIP-712 domain mismatches, the #1 integration bug), `forge coverage` stat on the final slide. Frontend: claim code in **URL fragment** (never sent to server), rate-limited claim lookup, RLS everywhere, pinned deps. ack3 = Ackee team (audited Monad itself, 237 audits/0 hacks) — a clean triaged-report submission maximizes the $15K scan's value.

## 10. What we CUT (scope discipline)

**Everything below is cut until the core loop (auth → escrow → send → claim → receipt) works end-to-end on testnet** — per external review, scope is the #1 risk with ~15 docs and one scaffold commit: ERC-3009 (TASK-306), encrypted note (TASK-506), Aurora (TASK-606), Envio indexer (TASK-605), Nansen labels panel, Alchemy routing. Once the core loop is green on testnet, re-admit in this order: Nansen labels → Envio → ERC-3009 → note → Aurora. Also cut: the full Nansen data product (a labels panel only, fed by our own events), multi-token support, recurring/subscriptions, family pools, AgentWallet plugin, Chainlink CRE, custom domain. Enemies: scope creep and a dead claim link.
