# Security Requirements

## Secrets
- Never commit private keys, mnemonics, or API secrets. `.env*` files are gitignored; only `.env.example` is committed.
- The dev burner key holds trivial test amounts only and never ships in a production build.
- Supabase service-role key lives only in server-side env; client uses anon key + RLS.

## Contract
- `SendEscrow` follows checks-effects-interactions (no reentrancy on claim/cancel); SafeERC20 everywhere.
- **Access model (v2 design — RESEARCH_TECH.md §3):** the ONLY on-chain access control is knowledge of the **32-byte link secret** (`keccak256(secret) == secretHash`, 128-bit entropy — brute-force infeasible). The claim is **relayer-submitted**: the destination is bound by the **payee's EIP-712 signature** over `(escrowId, secretHash, payee)` — the gas payer (relayer) can censor but never redirect; replaying observed calldata pays the same payee.
- **The phone number is NOT an on-chain control.** It routes where the link is sent (app layer); possession of the link secret is the access control. A forwarded link = handing someone cash — same as Linkdrop. Documented, not hidden.
- Only the escrow's sender can cancel; refund goes to `msg.sender`-sender, never an arbitrary address.
- Claim signature binds: escrow id + secretHash + payee account. OZ `ECDSA` rejects malleated/high-s signatures; `NoEscrow` guards nonexistent ids.
- No admin upgrade path that can touch user funds.
- Amounts handled as `uint256` base units (6 decimals); reject dust/negative at the UI layer too.

## Relayer (server wallet)
- The relayer can censor/delay claims, never redirect them (payee sig). Demo ships ONE relayer key with gas MON only — it holds no user funds and cannot move escrow contents anywhere but the signed payee.
- Relayer endpoint validates: payee address checksum, sig length, escrow not already claimed — before spending gas. Rate-limited per IP. The relayer API receives (id, payee, sig) only — never the link key.

## Input
- Validate all input server-side: phone (E.164), amount (> 0, ≤ balance), escrow id format.
- Validate every request body in API routes.

## Authorization
- Supabase row-level security on; claim records readable only via server routes keyed by keccak256(linkKey) — a 128-bit value that never appears on-chain and is never sent to the relayer.
- Row projection only: anon reads return amount/status/sender_hint — never raw addresses or key material.
- Users can only cancel their own escrows (enforced in contract, mirrored in API).

## Data
- Store **keccak256(linkKey)** for lookups — never the key itself, never raw phone numbers (the phone number routes where the link is sent and is not stored).
- No names, emails, or device identifiers in the database beyond what the flow requires.

## Before Deploy Checklist
- [ ] `git log -p` shows no secrets ever committed
- [ ] Contract verified on monadscan
- [ ] Mainnet deploy uses a fresh key with only gas MON
- [ ] RLS enabled on all Supabase tables
- [ ] All TEST_PLAN items passing on the live URL
