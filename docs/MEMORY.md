# Project Memory

## Current Status
TASK-101 complete — Next.js 16 + React 19 + Tailwind v4 + TS scaffolded, build/lint/typecheck green, pushed to `sreethan05/senda`.

## Completed
- Hackathon + track research (6-agent deep research, Oct 4)
- Product definition, name, corridor decision (senda, US→Nigeria)
- Full docs set (PRD, ARCHITECTURE, DESIGN, RULES, TASKS, DECISIONS, TEST_PLAN, SECURITY)
- Local folder `Desktop\senda` created; git repo connected to github.com/sreethan05/senda
- TASK-101 scaffold (Next.js 16.3.8, React 19.2.8, Tailwind 4, TS 5) + typecheck script

## Current Task
TASK-102 — env handling + chain constants module (`src/lib/config.ts`)

## Known Issues
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
