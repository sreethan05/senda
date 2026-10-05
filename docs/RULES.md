# Development Rules

## General
- Use TypeScript everywhere. No `any` in new code.
- Build ONE feature at a time: implement → test → review → commit → next.
- Reuse existing components; do not duplicate logic.
- Keep functions small; do not modify unrelated files.
- No new dependencies without a stated reason.

## Before Coding
- Read PRD.md, ARCHITECTURE.md, DESIGN.md for the relevant feature.
- Inspect existing implementation before changing it.
- Plan any large change before writing it.

## UI
- Follow DESIGN.md exactly (colors, radii, typography).
- Mobile-first at 375px; include loading, error, and empty states for every async view.
- Zero crypto jargon in user-facing copy (see DESIGN.md).

## Chain & Money
- ALL contract interactions go through `src/lib/chain/` — never call contracts from components.
- Every transaction shows: pending state → success state with explorer link (monadscan) → error state with retry.
- Amounts are parsed with correct decimals (AUSD = 6). Validate: amount > 0, ≤ balance, phone in E.164 format.
- Contracts: checks-effects-interactions; only sender can cancel; claims authorized by the ephemeral link key's signature (sketch v3) — the relayer cannot redirect, and the link key never leaves the URL fragment.
- Test contracts on Monad testnet (10143) before ANY mainnet deployment.
- NEVER commit private keys or mnemonics. Dev burner key lives only in `.env.local` (gitignored) and holds trivial amounts.

## Security
- Validate all input server-side in API routes.
- Supabase writes only from server routes; row-level security enabled.
- Never expose service-role keys to the client.

## Git
- Small commits, conventional messages (`feat: send flow escrow deposit`).
- Commit after every passing feature; never commit broken builds.
- Push to GitHub continuously — judges verify commit history spans the build window.

## Testing
- Feature isn't done until its TEST_PLAN.md items pass.
- Run lint + typecheck before every commit.
