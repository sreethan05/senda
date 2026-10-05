# Judge & Sponsor Intel (researched Oct 4-5, 2026)

Full cheat sheet for the people scoring senda. Sources: X posts, podcasts, fund pages — cited per entry. The distilled strategy lives in PITCH.md §2; this file is the reference detail.

## The judges

**Keone Hon — Monad Foundation Co-Founder/GM.** Ex-Jump Trading HFT lead. Frames Monad as "under tight consumer-hardware constraints… ~500M gas/sec, 400ms blocks" (Bankless, Nov 2025); mission = "expanding access to financial markets through open infrastructure"; "on-chain finance democratizes global access" (Crypto Briefing, Mar 2026). Personally amplified hackathon milestones incl. submissions launch. → Pitch angle: the app is only possible because Monad's throughput/latency makes real-time payments viable — then hide the chain.

**Eunice Giarta — Monad Co-Founder/GM.** Distributed-systems engineer (ex-Shutterstock VP Eng). Her May 2026 podcast: **"TPS Is a Lie! What Actually Makes a Blockchain Worth Building On"** — thesis: performance must translate into real UX; names stablecoins/payments as the app category that matters. "Tokenization should be earned, not forced." → Lead with UX outcomes (settlement time the user feels), never chain specs.

**Tina Qi — Monad Foundation Head of Ecosystem.** Runs founder programs (Mach, Jumpstart, Foundry, Residency). North star: founders who "**relentlessly ship**" with weekly public progress and blunt feedback. Coined "**dopamine markets**" — products that are "fun, fast and make them money" for zoomer users (Seed Club interview, Aug 2025). Cited "$70M+ raised by teams who call Monad home" (the $103M variant circulating is unverified — use $70M+). → Ship publicly, weekly, with metrics.

**Will Nuelle — Galaxy Digital GP.** Leads Galaxy Ventures ($113M fund). Authored Galaxy research: **stablecoins $300B by end-2025, $1T by 2030**; spoke at XREX Stablecoin Summit 2026 on cross-border settlement. Galaxy co-issues USDG. → Tie payment volume to the stablecoin-supply curve he already predicts.

**Maria Shen — Electric Capital GP.** Co-producer of Electric's annual Developer Report — developer growth predicts ecosystem winners (Asia now 32% of crypto devs). Messari fireside: "The Tourists Have Left. Here's What Crypto Natives Are Building." Electric invested in Monad's $225M round. → Show real, non-speculative, repeat usage; ship daily.

**Alex Svanevik — Nansen CEO.** "AI is already transforming how investors use onchain data… We're building the future of onchain intelligence." Nansen is a Metropolis sponsor (Best use of Nansen bounty). → Clean labeled onchain data; using Nansen's API in-product is a direct way to his rubric; "every metric verifiable via Nansen" is a judge-line.

**Wyatt Khosrowshahi — Castle Island Ventures.** Fintech/infra focus ($250M Fund III). Castle Island co-authored (with Visa, Brevan Howard, Artemis) **"Stablecoins: The Emerging Market Story"** — the canonical evidence that emerging-market stablecoin use is dominated by dollarization, goods, and remittances — literally senda's thesis. Portfolio: MoonPay, Bitwise. → A real corridor with weekly active users.

**Brett (Brett Sun, @sohkai) — Prelude cofounder.** Prelude = first-check fund (ex-Cherry, rebranded Apr 2025): "invests with just an idea," $500K–$2M checks, ~30 companies/fund. Has written on protocol valuation and new forms of money. → Pre-seed scout; crisp one-line thesis + live demo converts him.

**Yiping Lu — IOSG North America Investment Lead.** Designs IOSG's US thesis pipeline; check sweet spot ~$1.5M. IOSG's featured research: **"Stablecoins in Asian Cross-Border Payments: Strategic Landscape and Investment Thesis."** → Corridor-level unit economics + a research-grade write-up.

**Evan Feng — CoinFund Partner/Director of Research.** Stated interests: "decentralization, liberty, DeFi, **consumer**." Notes banks building their own stablecoins "to retain the float NIM" — float economics drive adoption. Portfolio: Jeeves (stablecoin-native banking), Dakota, Veda. → Who captures the float/yield in your product (answer: the user — that's the model).

**Frankie — Paradigm GP (@FrankieIsLost).** Paradigm **led Monad's $225M round** and co-built **Tempo** (Stripe's stablecoin-payments chain). Engineer-heavy firm. → Technical elegance + payments-grade reliability; you're pitching the firm that incubated a stablecoin L1.

**Ajit Tripathi ("Chainyoda") — Eigen Foundation Executive Director.** Ex-Polygon, ex-Binance Head of Financial Institutions, headed Aave institutional. Loud voice that stablecoins win only by bridging institutions. → Compliance posture: partner-model licensing, sanctions screening, demo-vs-production honesty. Pre-answered Q&As in PITCH.md §6.

**Elton Chang — Dragonfly Junior Partner.** Dragonfly led Monad's $19M seed. Thesis: "stablecoins have quickly become a credible alternative to traditional payment and settlement networks." Portfolio: **Agora** (our bounty sponsor), **Rain** (Monad card rails), **Afriex** (cross-border P2P), Ethena, Frax. → Name-drop Agora integration; consumer + stablecoin rails is exactly their book.

**Joey Shin — Pantera Capital Junior Partner.** Joined 2026; thin public record — read the firm: Pantera participated in Rain's $250M Series C ($1.95B valuation), highlights portfolio company **Coinflow** for stablecoin payment processing; Circle/Coinbase/Bitso among wins. → Monetizable payment volume, clear take-rate story.

**Uttam Singh — Alchemy Sr. DevRel Engineer.** Ex-Flare; produced account-abstraction (ERC-4337) educational content; advocates consumer-protection safeguards (circuit breakers, timelocks). → Technical execution quality: AA/passkey implementation, RPC reliability, graceful failure states are what a DevRel judge scores.

## Sponsors

**Agora (AUSD issuer — $10K cross-border bounty).** NYC, founded Oct 2023 by CEO **Nick van Eck** (+ Drake Evans, Joe McGrady). AUSD reserves managed by **VanEck**, custodied by **State Street**; ~#29 stablecoin, **$84B+ lifetime transfer volume**, rewards up to 2.7% APY. **OCC preliminary conditional trust-charter approval Sept 21, 2026.** Monad = their hottest chain: AUSD supply **$184M (+462% in 90 days)**, 10,000+ holders (Jul 2026), Foundation paying **$75K/week** AUSD liquidity incentives. Products a demo can touch: AUSD transfers (ERC-20/2612/3009/1271), **Instant Settlement** (fixed-price, zero-slippage swap protocol; AUSD/USDC pair live on Monad mainnet `0xf33286E3222D1c829dACeac48c0Ec651F6452470` — KYC-whitelisted on mainnet, self-whitelist on testnet), Public API (mint/redeem/accounts). What impresses them: real AUSD moving across a corridor, their rails showcased by name, institutional-grade compliance narrative, consumer-simple UX. Backed by Paradigm (lead), Dragonfly, CoinFund — the judge set owns this stack.

**Category Labs / Mera (2× $2.5K bounties).** Category Labs = Monad Labs rebranded (Dec 2024) — Keone Hon, James Hunsaker, Eunice Giarta; they write MonadBFT + the parallel EVM. Mera launched Jul 30 2026, preview, by team member @mveehkim. Their own framing of a 10/10 Mera UX: two-click onboarding, zero signing prompts mid-flow (signing sessions), cross-device restore, web+extension+React Native same account. Bounty 2 ("One Passkey, Many Keys") = most creative **non-wallet** use of PRF material — their docs showcase derivation + Secret Vaults (AES-256-GCM) but NOT: PRF as sign-in identity, E2E-encrypted content, per-app/per-corridor salt namespacing, encrypted memos — open space for senda's encrypted remittance note. No formal grants program — the Metropolis bounties ARE their showcase; early quality demos get outsized visibility (issues on github.com/category-labs/mera are read by the team).

**Aurora Intents ($5K "Bring Any-Chain Liquidity to Monad," All tracks, split 3 ways).** NEAR-Intents-powered cross-chain deposits/swaps. Bounty names Swap API, Intents Deposits, Intents Connect. Verified Oct 5: Monad has 3 assets (MON, USDT0, USDC) — not AUSD; Monad pairs unquotable unauthenticated post-exploit (Sept 30, patched Oct 2, ~$3.8M, compensated); **no testnet**; keys self-serve at studio.aurora.dev. Widget: `@aurora-is-near/intents-swap-widget`. They RT integrations; contact contact@aurora.dev. Stretch only — see PITCH.md §10.

## Contact channels (build window)
- Discord: `discord.gg/monaddev` (official Metropolis channel — bounty fine print + sponsor office hours; ask for Agora/Category Labs channels)
- X: @monad_dev, @keoneHD, @withAUSD (Agora), @Nick_van_Eck, @category_xyz, @mveehkim (Mera's builder — highest-signal demo viewer), @auroraisnear
- Hashtag: "Metropolis hackathon" + #Monad (no verified official tag); cross-post LinkedIn (Monad amplifies there)
- IRL (optional): Metropolis Lounges — NYC Sep 18, Hangzhou Sep 19, Shenzhen Sep 26, SF Sep 26, London Oct 2, Buenos Aires Oct 3, Singapore Oct 6
