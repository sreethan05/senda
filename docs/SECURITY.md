# Security Requirements

## Secrets
- Never commit private keys, mnemonics, or API secrets. `.env*` files are gitignored; only `.env.example` is committed.
- The dev burner key holds trivial test amounts only and never ships in a production build.
- Supabase service-role key lives only in server-side env; client uses anon key + RLS.

## Contract
- `SendEscrow` follows checks-effects-interactions (no reentrancy on claim/cancel).
- Only the escrow's sender can cancel; refund goes to `msg.sender`-sender, never an arbitrary address.
- Claim signature binds: escrow id + recipient phone hash + recipient account. A passkey from a different phone hash cannot claim.
- No admin upgrade path that can touch user funds.
- Amounts handled as `uint256` base units (6 decimals); reject dust/negative at the UI layer too.

## Input
- Validate all input server-side: phone (E.164), amount (> 0, ≤ balance), escrow id format.
- Validate every request body in API routes.

## Authorization
- Supabase row-level security on; claim records readable only via server routes with the link's id + phone hash.
- Users can only cancel their own escrows (enforced in contract, mirrored in API).

## Data
- Store salted phone HASHES, never raw numbers.
- No names, emails, or device identifiers in the database beyond what the flow requires.

## Before Deploy Checklist
- [ ] `git log -p` shows no secrets ever committed
- [ ] Contract verified on monadscan
- [ ] Mainnet deploy uses a fresh key with only gas MON
- [ ] RLS enabled on all Supabase tables
- [ ] All TEST_PLAN items passing on the live URL
