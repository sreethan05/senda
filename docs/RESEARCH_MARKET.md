# Market Refresh — How Payments Work Now (verified Oct 5, 2026)

Fresh pass on competitors + current rails. Complements PRD (macro numbers) and RESEARCH_TECH.md (implementation). This file exists because judges will ask: *"Bitso exists. Daimo tried this. Why you?"*

---

## 1. Does senda's exact product exist? — No, but its ghost does

| Product | Passkey-only | Claim-link/phone | AUSD/Monad | Status |
|---|---|---|---|---|
| **Daimo** (Base/USDC) | ✅ | ✅ (link; claim created passkey acct) | ❌ | **Consumer app shut down Feb 2026** → pivoted to B2B "Daimo Pay" |
| **Beam** (Squads, Solana/USDC) | ~ | ✅ (link + phone) | ❌ | Acquired by Modern Treasury Oct 2025, wound down |
| **Valora** (Celo) | ❌ (phone/seed) | ✅ (Live Links, phone sends) | ❌ | Founding team acqui-hired by **Stripe** Dec 2025 |
| **Coinbase Wallet links** (Base/USDC) | ✅ at claim time | Partial (SMS/email links) | ❌ | **Live at scale** — passkey-at-claim is a shipped pattern |
| **Peanut, Strike, StablePay (Sep 2026), Eversend/Sendwave** | mixed | link/phone variants | ❌ | Alive, various chains |
| **Anything on Monad** | — | — | ❌ | **Zero consumer P2P apps** — only AnomaPay tagged "Payment" on app.monad.xyz; nobody building AUSD consumer remittance publicly |

**Verdict:** the exact combination is unclaimed — but it is a *re-entry into a graveyard*, not an invention. Three consecutive consumer exits (Daimo, Beam, Valora→Stripe) say standalone "Venmo-for-stablecoins" failed on **distribution/retention, not mechanics**. The honest pitch: *"Daimo's mechanics + Bitso's B2B proof + Monad's timing + a corridor the incumbents are fleeing."* The write-up must own the graveyard before a judge raises it.

**Name check:** no crypto payments app named "Senda"/"SendaX" exists. ✓

## 2. How the corridor actually works now (US→Nigeria, $200)

| Provider | Est. total cost* | Arrival | Notes |
|---|---|---|---|
| Western Union | ~4–9% ($8–18) | <1h cash / days to bank | Consumer revenue **−7.7% YoY** |
| Bank wire (SWIFT) | ~15–20% | 1–5 days | Worst formal channel |
| Remitly | ~1.5–4% | minutes–5 days | $0 promos, spread in rate |
| **Wise** | **N/A — dropped NGN entirely** | — | Price leader fled the corridor (2026) |
| LemFi / Nala / Afriex / Sendwave | **$0 fee, ~1–3% hidden FX spread** | minutes–seconds | The real competitors; opaque rate = business model |
| Raw USDT P2P | ~3–5% effective | minutes–hours | Huge in Nigeria; friction + fraud |

*FX moves daily — quote as "typical 2026 ranges." Global average still 6.36% (World Bank Q3 2025); Nigeria received ~$21.8B in 2025.

## 3. What changed in 2025–2026 (the pitch's new ammunition)

1. **Stablecoin rails won the B2B layer:** $135B retail cross-border stablecoin payments in 2025 (up from $82B); Bitso claims ~14.7% of all US→Mexico remittances; LemFi×BVNK, Nala→infrastructure ($70M+ raised), Thunes delivers USDC to 11,500 banks via SWIFT; MoneyGram launched its own MGUSD + USDC-cash ramps at 480K locations; Western Union announced USDPT (Solana). **The rails are proven — the consumer front-end is up for grabs.**
2. **US 1% remittance excise tax** (OBBBA §4475, effective Jan 1 2026) is levied on provider-mediated transfers — self-directed stablecoin transfer sits outside that plumbing. Every WU/Remitly send now carries a compliance tax senda's rail avoids.
3. **Nigeria flipped crypto-friendly:** CBN+SEC joint regulations (Oct 2025), presidential crypto order with CBN-chaired Virtual Asset Council (Jul 2026), SEC-authorized cNGN naira stablecoin, **>65% of Nigerian crypto inflows already in stablecoins**. Naira lost 70% vs USD 2023–25 (official ~₦1,329, parallel ~₦1,370+, Oct 2026) — dollar-savings framing resonates.
4. **The differentiation is transparency, not just price:** LemFi/Afriex charge $0 and hide 1–3% in the rate with no proof of the path. On Monad, senda's rate path, fee, and settlement are **verifiable on-chain** — "the transparent dollar vs the opaque dollar."

## 4. Changes this forces in senda

- **Receipt comparison (TASK-601):** show WU (4–9%) for emotional contrast **and** "typical app: $0 fee, 1–3% hidden in the rate" for honesty — then senda: $0.01, on-chain verifiable. Winning on "cheaper than WU" alone is a strawman; winning on *verifiable* is not.
- **Write-up must pre-empt Daimo:** one paragraph owning why prior consumer attempts died (distribution, not mechanics) and why Monad's empty consumer lane + Metropolis mentorship + corridor partnerships change the distribution math.
- **Kill any "we're first" language.** We are first *on this chain, with this asset, right now* — say exactly that.
- Corridor data: NGN display uses official rate; parallel-market premium (~4–5%) is a talking point for dollar-holdings framing, not a feature we fake.

## Sources
Base blog (Coinbase passkey links), daimo.com + GitHub shutdown notice, Modern Treasury/Beam, CoinDesk (Stripe×Valora), peanut.me, strike.me, app.monad.xyz, stabledash (AUSD $144M on Monad), ChainGain (MoneyGram MGUSD), KoalaGains (WU FY2025), Launchbase (Zepz $17B), Spark.money (Bitso 14.7%), bvnk.com, TechAwk (Nala), JD Supra + NPR (1% excise tax), FinanceFeeds (Nigeria crypto order), TechCabal/Binance (65% stablecoin inflows), grey.co + abokifx (NGN rates/spreads), remittanceprices.worldbank.org (6.36%), IIARD (Nigeria $21.8B).

---

# Field Intel — Metropolis competition (Oct 5 refresh)

## Scale (VERIFIED vs INFERRED)
- **VERIFIED:** build window Sep 1–Oct 13; judging Oct 14–27; winners Nov 3; submissions portal live (~Oct 1, Keone Hon confirmed on X). **Agora runs two $10K bounties** — "Best Mobile Trading App" and "Best Cross-Border Payments App" (senda targets the latter). 4 tracks × $30K = 12 track winners ($10K each) + $25K champion + ~25 bounties ≈ **38 winnable slots**. 73 mentors/judges; 7 in-person activations; ~50 university community partners; QuickNode $73.5K credits.
- **VERIFIED (single source):** "1,500+ builders registered" (Monad community post, mid-Sept).
- **INFERRED:** ETHGlobal conversion (20–35%) → **best estimate 300–600 submissions**; precedent: evm/accathon 350+ builders → 86 projects; one 0x bounty there drew 11 submissions. Per-track: 3 winners of ~75–150 consumer entries ≈ 2–4%; any-prize odds incl. bounties ≈ 6–12%.

## Known competitors (payments + Agora bounty)
- **"WeMadeIt"** — the only publicly findable Metropolis submission: AUSD-denominated **group pot / money pool** app (YouTube: "WeMadeIt | Metropolis hackathon Agora bounty demo"). Adjacent (shared savings), not a corridor remittance product. Differentiation: senda is a true corridor flow.
- Ecosystem incumbents eligible to enter with new work: Monad Pay (virtual Visa card), Rain (card issuing), TransFi (B2B rails). No dominant consumer remittance app on Monad; Foundation acquired payments infra (Portal, Jul 2025).
- X is poorly indexed — absence of named competitors is NOT evidence of a thin field. Expect a long tail of unannounced payment apps (the track brief literally invites them).

## Track crowding verdict
**Finance/Trading: most crowded** (Monad = "Home of High-Frequency Finance"; trading sponsors dominate: Kuru ×2, Perpl ×2, Spectrum). **AI/Trust: fewer, higher-polish entries.** **Social: likely least crowded.** **Consumer/Payments: moderate** — sponsor gravity pulls entries, but remittance specifically is an open niche. Identical $30K/track weighting → payments has better per-capita odds than trading.

## Tactical implications (this week)
1. Narrow corridor, ship end-to-end, real mainnet AUSD txs, mobile-first PWA in a phone frame.
2. **"Agora" + "AUSD" in the first two lines** of the write-up and demo — bounty judges triage hundreds of entries; WeMadeIt's loose pot-framing shows the bounty is being read loosely; a true corridor flow stands out.
3. Stack adjacent bounties in a separate section of the submission (don't dilute the main narrative).
4. **Submit Oct 10–11** — early buys zero judge attention (judging starts Oct 14) but eliminates final-48h portal congestion (standard hackathon pattern: most teams submit last 2 days).
5. Demo video ≤ 3 min, phone-framed, real txs — at 334-project ETHOnline scale, finalists were all production-polished.

## Build-in-public strategy (earns the $5K Community Team bounty)
- Tag: @monad_dev (amplifies hackathon content), @keoneHD (posts milestones personally), @withAUSD, @category_xyz, @mveehkim; sponsors you actually use (Envio demonstrably RTs teams).
- Phrase: "Metropolis hackathon" + #Monad; cross-post LinkedIn (Monad's community team amplifies there — the 1,500-builder stat circulated via LinkedIn).
- Cadence 2–3 posts/week: (1) problem/corridor thread, (2) real-send screen recording, (3) final demo clip on submission day.
