# Project Memory

## Current Status
Planning complete. Documentation written. Awaiting repo init → TASK-101.

## Completed
- Hackathon + track research (6-agent deep research, Oct 4)
- Product definition, name, corridor decision (senda, US→Nigeria)
- Full docs set (PRD, ARCHITECTURE, DESIGN, RULES, TASKS, DECISIONS, TEST_PLAN, SECURITY)
- Local folder `Desktop\senda` created

## Current Task
TASK-101 — init Next.js + TypeScript + Tailwind (once git repo is in place)

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
Clone/pull the GitHub repo into `Desktop\senda`, then run TASK-101.
