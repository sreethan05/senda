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
- AUSD (mainnet): `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a`, decimals 6
- Monad testnet: chain 10143, RPC `https://rpc.testnet.monad.xyz`, faucet `faucet.monad.xyz`
- Mera: npm `@category-labs/mera`, docs `mera.category.xyz`, GitHub `category-labs/mera`

## Next Step
TASK-102, then TASK-103 (Vercel preview — needs user's Vercel login) and TASK-104 (acquire MON for mainnet gas — no faucet exists).
