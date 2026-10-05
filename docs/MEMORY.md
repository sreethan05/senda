# Project Memory

## Current Status
Full research phase CLOSED (18 agents total: 6 strategy + 2 feasibility + 4 tech + 6 depth waves). Master strategy in PITCH.md. Build unblocked — Phase 1-2 next.

## Key strategy facts (Oct 5 waves)
- **Position as settlement rail, not retail app** — own the Daimo/Nala graveyard; Tether invested in LemFi; rails win, wallets die.
- Judges' shared themes: stablecoin rails / hide-the-chain / remittances / passkeys / verified shipping (cheat sheet in PITCH.md §2).
- Agora Instant Settlement live on Monad (AUSD/USDC pair) — name-drop in write-up; ERC-3009 promoted to TASK-306; encrypted note = Mera double-bounty play (TASK-506).
- Competition: ~300–600 submissions est.; one public payments competitor (WeMadeIt, group pots); Finance track most crowded; remittance niche open.
- Off-ramp answer: Busha/Yellow Card API (Mercuryo doesn't settle NGN); signed payout-order mock.
- Compliance: §4475 1% tax does NOT apply to self-directed wallet-to-wallet; partner-model licensing story; demo disclaimer written (PITCH.md §6).
- Domain: all senda.* taken; ship on vercel.app (valid rpId via Public Suffix List); brand purchase post-hackathon.
- Demo rig: scrcpy ×2 phones + Screenity + Clipchamp (free auto-captions); 5-beat 90s structure (PITCH.md §7).

## Completed
- Hackathon + track research (6-agent deep research, Oct 4)
- Product definition, name, corridor decision (senda, US→Nigeria)
- Full docs set (PRD, ARCHITECTURE, DESIGN, RULES, TASKS, DECISIONS, TEST_PLAN, SECURITY)
- Local folder `Desktop\senda` created; git repo connected to github.com/sreethan05/senda
- TASK-101 scaffold (Next.js 16.3.8, React 19.2.8, Tailwind 4, TS 5) + typecheck script

## Current Task
TASK-102 — env handling + chain constants module (`src/lib/config.ts`)

## Known Issues
- **Daimo precedent:** near-identical product (passkey + link claims, USDC/Base) shut its consumer app Feb 2026 — distribution failure, not mechanics. Write-up MUST pre-empt this (RESEARCH_MARKET.md §1/§4). Never use "we're first" language; claim is "first on Monad with AUSD, right now".
- Real fee competitors are LemFi/Nala/Afriex ($0 fee, ~1–3% hidden FX spread), not just WU — receipt comparison must include them (TASK-601 updated).
- No public mainnet MON faucet — need to buy/bridge a small amount of MON for gas (TASK-104)
- NEAR Intents exploited Sept 30 2026, patched Oct 2 — only relevant if stretch TASK-606 is attempted
- Mera PRF requires Chrome/Edge (no Firefox) — demo browser is Chrome
- Mera is preview software (v0.2.0); pin the version
- Reported EIP-1271 passkey edge case on Monad — prefer Mera-derived EOA signing path

## Key Constants
- Monad mainnet: chain 143, RPC `https://rpc.monad.xyz`, explorer `monadscan.com`
- AUSD (mainnet): `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a`, decimals 6, EIP-712 domain name "Agora Dollar"
- Monad testnet: chain 10143, RPC `https://testnet-rpc.monad.xyz`, faucet `faucet.monad.xyz`
- AUSD (testnet): `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` — faucet contract `0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C` `requestFunds(address)` → 10,000 AUSD
- Native USDC (mainnet): `0x754704bc059f8c67012fed69bc8a327a5aafb603` (swap → AUSD on Uniswap V4 for demo funds)
- Mera: pin `@category-labs/mera@0.2.0`, viem adapter `@category-labs/mera/viem`, docs `mera.category.xyz`
- Foundry ≥ v1.8.0 required (`network = "monad"` in foundry.toml); verify via Sourcify `https://sourcify-api-monad.blockvision.org/`
- NGN rate: `https://open.er-api.com/v6/latest/USD` (no key), fallback 1330
- Full details: [RESEARCH_TECH.md](RESEARCH_TECH.md)

## Next Step
TASK-102, then TASK-103 (Vercel preview — needs user's Vercel login) and TASK-104 (acquire MON for mainnet gas — no faucet exists).
