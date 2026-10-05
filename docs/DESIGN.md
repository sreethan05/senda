# Design System

> Researched Oct 5 (Wise/LemFi/Remitly teardowns, FIDO passkey UX guidance, mobile-web polyfill guides) — see PITCH.md §8. Rules below are evidence-based, not taste.

## Style
Modern, minimal, warm. Consumer fintech (Wise-class discipline: the cost block is sacred). Explicitly NOT crypto-branded. No hexagons, no neon, no "Web3" iconography anywhere.

## Typography
**Inter** for UI + amounts (tabular-nums, amounts always visually larger than labels). **Plus Jakarta Sans 700/800** for headings/brand moments. Both Google Fonts, $0.

## Icons & assets
**Lucide** (matches Inter's 24px grid). One unDraw illustration max. Wordmark = typed lowercase "senda" — no AI-generated logo. Favicon/PWA icons: one 1024px mark → RealFaviconGenerator + PWABuilder maskable pipeline.

## Colors
| Role | Value |
|---|---|
| Primary (send / confirm) | `#10B981` emerald — THE one green; never decorative |
| Background | `#FAFAF9` warm white |
| Text | `#1C1917` |
| Muted text | `#78716C` |
| Accent (arrival / success) | `#F59E0B` warm amber — one celebratory element only (confetti XOR checkmark, never both) |
| Danger | `#DC2626` |
| Card surface | `#FFFFFF` |

## The sacred cost block (Wise pattern)
The SAME 4-line block appears at every reconsideration point — send screen, confirm, receipt:
**You send / Fee (own line item, never baked in) / Rate + "usually instant" / They get.**
Numbers set larger than labels; secondary detail in grey. Fee shown on the FIRST send screen, not revealed at confirm.

## Screens
1. **Home** — balance as the dominant number, NGN equivalent underneath, one green "Send money" CTA bottom-anchored, activity list with plain-language status chips.
2. **Send** — custom numeric keypad docked bottom (OS keyboard never appears), quick-amount chips, live "they get ₦…" reciprocity updating per keystroke, phone input with country code (`inputmode="tel"`, auto-format).
3. **Confirm** — cost block + arrival estimate ("~10 seconds · usually instant") + recipient row with edit affordance. One CTA.
4. **Claim** — sender + amount revealed ABOVE the fold BEFORE any signup wall ("Aisha sent you $50" + one green Claim button). Passkey ceremony is one tap. FIDO rule: value moment first.
5. **Receipt** — amount, itemized fee, rate + lock time, arrival timestamp, reference number, share/download, one honest flourish: "Banks typically charge $6–12 here. senda charged $0.01."

## Mobile-web native polyfills (all mandatory)
`viewport-fit=cover` + safe-area `calc()` padding; `100dvh` shell; **16px minimum inputs** (iOS zoom); `touch-action: manipulation`; 48px touch targets + `user-select:none` + custom `:active` states; `overscroll-behavior: none`; `inputmode` everywhere; **standalone PWA manifest + theme_color** (biggest "feels like an app" lever); no hardcoded bottom offsets.
