# senda

> **send a dollar home in a second.**

Cross-border remittances that feel like texting. Built for the [Monad Metropolis hackathon](https://monad.xyz/developers/hackathons/metropolis).

## What it is

senda lets a worker abroad send AUSD (Agora's stablecoin) to a phone number. The recipient opens a claim link, creates a passkey with their fingerprint (Mera — no seed phrase, no app store, no crypto knowledge), and the money is theirs in under a second.

- **No 6.4% fees.** The World Bank average cost of sending $200 is 6.4%; into Nigeria it's 8%+. senda costs fractions of a cent on Monad.
- **No 1–5 day waits.** Monad settles in ~1 second.
- **No seed phrases.** Mera passkey onboarding — the account IS the fingerprint.

## Hackathon context

- **Track:** Consumer Products & Payments
- **Bounties targeted:** Agora Cross-Border Payments ($10K), Best Mera-Powered UX ($2.5K), Aurora Intents (stretch, $5K)
- **Submission deadline:** Oct 13, 2026

## Docs

| File | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | What are we building and why |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it works |
| [docs/DESIGN.md](docs/DESIGN.md) | How it should look and feel |
| [docs/RULES.md](docs/RULES.md) | Development rules |
| [docs/TASKS.md](docs/TASKS.md) | Task breakdown (8 days) |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architecture decisions (ADRs) |
| [docs/MEMORY.md](docs/MEMORY.md) | Current project state |
| [docs/TEST_PLAN.md](docs/TEST_PLAN.md) | What "working" means |
| [docs/SECURITY.md](docs/SECURITY.md) | Security requirements |
| [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) | Configure the optional, server-side history index |
| [docs/PITCH.md](docs/PITCH.md) | Master strategy: positioning, judges, bounties, demo plan |
| [docs/RESEARCH_TECH.md](docs/RESEARCH_TECH.md) | Verified technical research (Mera, AUSD, escrow, infra) |
| [docs/RESEARCH_MARKET.md](docs/RESEARCH_MARKET.md) | Market + competitor + field intel |
| [docs/RESEARCH_JUDGES.md](docs/RESEARCH_JUDGES.md) | Judge-by-judge cheat sheet + sponsor profiles |
| [docs/RESEARCH_SECURITY.md](docs/RESEARCH_SECURITY.md) | Vulnerability matrix + Foundry test plan |

## Status

Planning complete. See [docs/MEMORY.md](docs/MEMORY.md).
