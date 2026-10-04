# Test Plan

## Auth
- New user can create a passkey account (Chrome, Android/desktop)
- Returning user can log in with existing passkey
- Logged-out user cannot access /send or /history
- Dev burner mode works behind env flag and is inert in production build

## Send Flow
- User can send a valid amount to a valid E.164 phone number
- Amount > balance is rejected with a clear error
- Amount ≤ 0 / non-numeric / empty phone rejected before any transaction
- Deposit shows pending → success with monadscan link; failure shows retry
- Claim link opens on a second device/browser profile
- Cancel (unclaimed) refunds full amount to sender

## Claim Flow
- Recipient with no account can create passkey and claim
- Claim credits the correct amount
- Second claim attempt on the same escrow fails gracefully
- Expired/cancelled link shows a friendly state, no contract revert exposed
- Claim from a different phone number's passkey fails (signature binding)

## Contracts (Foundry)
- deposit → claim happy path
- deposit → cancel happy path
- claim twice reverts; cancel after claim reverts
- claim with wrong signature reverts
- amounts with 6-decimal precision round-trip exactly

## Responsive
Test at: 375px (primary), 768px, 1440px

## Production QA (before recording demo)
- Live Vercel URL: full send → claim loop on two real devices
- Mainnet tx visible on monadscan with correct amounts
- Slow-network pass (throttled) doesn't strand the UI in pending
- Empty states on fresh account
