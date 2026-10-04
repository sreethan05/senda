# Design System

## Style
Modern, minimal, warm. Consumer fintech (Venmo/Wise energy) — explicitly NOT crypto-branded. No hexagons, no neon gradients, no "Web3" iconography anywhere.

## Typography
Inter (400 / 600 / 700). Large numerals for amounts (tabular-nums).

## Colors
| Role | Value |
|---|---|
| Primary (send / confirm) | `#10B981` emerald |
| Background | `#FAFAF9` warm white |
| Text | `#1C1917` |
| Muted text | `#78716C` |
| Accent (arrival / success moments) | `#F59E0B` warm amber |
| Danger (cancel / errors) | `#DC2626` |
| Card surface | `#FFFFFF` |

## Buttons
- **Primary:** emerald fill, white text, pill shape (radius 999px), 52px height (thumb-friendly)
- **Secondary:** white fill, 1px stone-300 border
- **Destructive:** white fill, red border + red text

## Cards
Border radius 16px, subtle shadow (`0 1px 3px rgba(0,0,0,0.08)`), 16px padding.

## Screens
1. **Home** — balance (large), "Send money" primary button, recent transfers list
2. **Send** — amount pad → phone input → confirm sheet (fee + arrival time shown BEFORE send)
3. **Claim** — link landing: amount, sender name, one big "Claim with fingerprint" button
4. **Receipt** — amount delivered, settlement time, total cost, WU comparison bar
5. **History** — list with status chips (Sent / Claimed / Cancelled)

## UX Requirements
- Mobile-first: design at 375px, verify at 768px / 1440px
- Every async action has a loading state
- Empty states are friendly and instructive ("No transfers yet — send your first one")
- Error states name the problem and the next step
- **Zero crypto jargon in the UI.** Never say wallet, gas, chain, token, crypto. Say "money", "fee", "arrives".
- Amounts show USD + converted NGN (demo corridor) side by side
