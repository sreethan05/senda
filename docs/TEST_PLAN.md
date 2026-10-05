# Test Plan

## Auth
- New user can create a passkey account (Chrome, Android/desktop)
- Returning user can log in with existing passkey
- Logged-out user cannot access /send or /history
- Dev burner mode works behind env flag and is inert in production build

## Send Flow
- User can send a valid amount; a 32-byte ephemeral link key is generated client-side and its private half lives ONLY in the link fragment
- Amount > balance is rejected with a clear error
- Amount ≤ 0 / non-numeric / empty phone rejected before any transaction
- Deposit shows pending → success with monadscan link; failure shows retry
- Claim link opens on a second device/browser profile
- Cancel (unclaimed) refunds full amount to sender

## Claim Flow (relayer-submitted — recipient has zero MON)
- Recipient with no account can create a passkey and claim — server wallet pays gas, recipient signs `Claim(id, secretHash, payee)` with their passkey
- Claim credits the correct amount to the payee
- **Claim without the link secret reverts `BadSecret`** (secret never leaves the fragment until claim)
- **A sig over a different payee address reverts `BadSignature`** — the relayer cannot redirect funds
- Second claim attempt on the same escrow reverts; nonexistent id reverts `NoEscrow`
- Expired/cancelled link shows a friendly state, no contract revert exposed
- **WhatsApp in-app webview test:** claim link opened from a WhatsApp chat — if the webview blocks PRF, the "open in browser" fallback path is exercised (test on a real Android phone BEFORE building around it)

## Contracts (Foundry)
- deposit → claim happy path
- deposit → cancel happy path
- claim twice reverts; cancel after claim reverts
- claim with wrong signature reverts
- claim with a signature over a different payee reverts `BadLinkKeySignature` (relayer-redirect attempt included)
- amounts with 6-decimal precision round-trip exactly
- **frozen/paused states (first-class):** claim while AUSD `isAccountFrozen(claimant)` reverts atomically, escrow stays pending, retry succeeds after unfreeze; same for `isTransferPaused()` on deposit/claim/cancel/reclaim (fork tests with mocked OFT behavior)
- **expiry boundary:** claim at exact `expiresAt` succeeds; reclaim one second later succeeds; `ttl < 10 min` reverts

## Responsive
Test at: 375px (primary), 768px, 1440px

## Production QA (before recording demo)
- Live Vercel URL: full send → claim loop on two real devices
- Mainnet tx visible on monadscan with correct amounts
- Slow-network pass (throttled) doesn't strand the UI in pending
- Empty states on fresh account
