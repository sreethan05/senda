# Security Research (Oct 5, 2026) — ack3 prep, vulnerability matrix, test plan

Feeds TASK-307. **Design basis: sketch v3 — Linkdrop-style ephemeral link key** (see RESEARCH_TECH.md §3). The link fragment holds a 32-byte ephemeral private key; the escrow stores its address; the claim authorization is that key's EIP-712 signature over `(escrowId, payee)`, relayed by a server wallet. This supersedes both the 6-digit-code design (brute-forceable) and the v2 shared-secret relayer design (relayer learned the secret from its own calldata and could redirect — caught in review).

ack3 (the $15K scan sponsor) = the Ackee Blockchain team (audited Monad, Lido, Aave, Safe; 237 audits, zero client hacks); they author the Wake framework. Their public methodology: (1) system modeling, (2) AI scan pinned to a scoped commit, (3) manual + agentic review (Wake static analyzer), (4) auditor-guided fuzzing. **To maximize the scan's value: pin a clean tagged commit, ship a threat-model doc, pre-run Slither/Aderyn with a triaged report, and land the invariant suite below — pre-existing invariants let their fuzzers attack your handler instead of rediscovering basics.**

## Vulnerability matrix (SendEscrow v3: depositTo(linkKey, amount, ttl) → relayer claim(id, payee, sig) → cancel / reclaim)

| Threat | Mitigated? | One-line test |
|---|---|---|
| **Relayer redirect** (relayer claims to its own address) | ✅ relayer never sees the link key — only its signature over a fixed payee; forging for another destination requires the key | Relayer signs for itself → recover(sig) != stored linkKey → `BadLinkKeySignature` |
| **Mempool front-run / theft** (watcher sees claim calldata) | ✅ calldata = (id, payee, sig); replay pays the same payee; forging needs the key (never broadcast) | Replay verbatim → pays payee; mutated payee → recover fails |
| Signature malleability (EIP-2 high-s) | ✅ OZ5 `ECDSA.recover` rejects s > n/2 | Fuzz s' = n−s → revert |
| Replay across escrows / chains | ✅ digest carries `escrowId` + `payee`; EIP-712 domain pins chainId + contract | Replay escrow-A sig on B → revert |
| Sig/destination binding mismatch (sig over different payee) | ✅ signed payee is checked against the payee argument by construction (digest encodes payee) | Sign for payee A, submit with payee B → revert |
| Zero-amount deposit griefing | ⚠️ explicit `amount == 0` check present | fuzz deposit(0) → revert |
| Claim/cancel boundary race | ⚠️ explicit: claim iff `ts <= expiry`, reclaim iff `> expiry` | `vm.warp(exactExpiry)` claim passes; `warp(+1)` reclaim passes |
| Same-block deposit+reclaim (ttl=0) | ✅ `ttl >= MIN_TTL (10 min)` | deposit(ttl=0) → revert |
| uint96 overflow @ 6 decimals | ✅ uint96 ≈ 79e21 AUSD; Solidity 0.8 checked | fuzz max amounts |
| Fee-on-transfer token assumption | ✅ by scope: AUSD is plain ERC-20 — document; SafeERC20 used | FoT mock: deposit 100, get 90 → documents behavior |
| Reentrancy (ERC-777-style hooks) | ✅ AUSD has no hooks + CEI + effects before transfer | reentrant mock reenters claim → no-op |
| ecrecover zero-address | ✅ OZ5 reverts; `linkKey == 0` deposit guard | garbage sig → custom error |
| **Link-key leakage** (fragment in history/screenshots/shared logs) | ⚠️ possession = ownership (documented cash analogy); fragments aren't sent to servers (RFC 9110 §7.3); ttl + reclaim bound exposure | — |
| Sender cancels after claim broadcast | ⚠️ last-tx-wins policy, documented | two-tx race test |
| Direct token donation breaks solvency | ✅ invariant is `balance >= sum(unclaimed)` (not ==) | handler donation → invariant holds |
| Upgrades/initializer | N/A immutable, no proxy | — |

## Foundry test list (1.5 days, solo)

**`test/unit/SendEscrow.t.sol`** — `test_Deposit_PullsTokensAndRecordsEscrow`, `test_Deposit_RevertZeroAmount`, `test_Deposit_RevertInsufficientAllowance`, `test_Deposit_RevertTtlBelowMinimum`, `test_Deposit_RevertZeroLinkKey`, `test_Claim_HappyPath_PaysPayeeExactAmount`, `test_Claim_RevertNotLinkKey_ForgedSig`, `test_Claim_RevertRelayerRedirectAttempt`, `test_Claim_RevertMalleatedSig`, `test_Claim_RevertReplayOtherEscrow`, `test_Claim_RevertAfterExpiry`, `test_Claim_AtExactExpiryBoundary`, `test_Claim_RevertDoubleClaim`, `test_Claim_NoEscrow_NonexistentId`, `test_Cancel_OnlySender`, `test_Cancel_RevertAfterClaim`, `test_Cancel_NoEscrow_NonexistentId`, `test_Reclaim_OnlyAfterExpiry_PaysSender`, `test_Reclaim_RevertTwice`, `test_ReentrantToken_RevertOnReentry`, `test_FeeOnTransferMock_AssumptionDocumented`

**`test/fuzz/SendEscrow.fuzz.t.sol`** — `fuzz_DepositClaimRoundTrip(uint96,uint256 seed)` (bound amount, derive link key from seed), `fuzz_NoClaimWithoutLinkKeySig(address attacker,uint256 victimPk,uint256 attackerPk)` (attacker signs for itself → recover != linkKey → revert), `fuzz_MutatedPayeeNeverPays(uint256 pk,address attacker)` (sig over payee A, submit payee B → revert)

**`test/invariants/`** — handler with actors (deposit / claim w/ link-key sig / cancel / reclaim / warp) + ghost variable `escrowedTotal`:
`invariant_Solvency_BalanceGeEscrowedTotal`, `invariant_NoDoublePayout` (per-id state machine pending→claimed|cancelled|reclaimed, terminal sticky), `invariant_SenderNeverLosesMoreThanDeposited`

**`test/fork/SendEscrowFork.t.sol`** — `fork_Claim_RawAusd6Decimals` (fork Monad testnet at real AUSD address), `fork_E2E_FrontendDerivedSigClaims` (produce the EIP-712 digest **exactly as the Next.js client does** — catches domain name/version/chainId mismatch, the #1 integration bug), `fork_Claim_RevertsWhenFrozen_Mock` (frozen/paused AUSD → atomic revert, escrow stays pending)

**Gas:** `forge snapshot --snap .gas-snapshot`, commit it, `--diff` in CI. Total ≈ 27 tests → `forge coverage` stat goes on the final slide.

## Static analysis

```bash
pip install slither-analyzer && slither . --exclude-informational
cargo install --git https://github.com/Cyfrin/aderyn && aderyn .   # or release binary
```
Fix: unchecked ERC-20 returns (SafeERC20 used), missing amount/ttl validation (present). Triage with written justification: reentrancy-events false positive under CEI + plain ERC-20, centralization on sender cancel (product intent), naming/pragma NCs. Plain-EVM source analysis — no Monad compatibility work needed; only fork tests need the RPC.

## Frontend security checklist (write-up section)

1. **Passkey phishing:** rpId binds credentials to the registrable domain — a lookalike site cannot invoke the user's passkey (WebAuthn spec). Scope: protects the ceremony, not session cookies → HttpOnly/Secure/SameSite cookies.
2. **Link-key handling:** the key lives in the **URL fragment** — never transmitted to any server (RFC 9110 §7.3), so Supabase/CDN/proxy/relayer logs never see it. Acknowledge: fragments persist in history/screenshots; keep out of referrer; ttl + reclaim bound exposure. Query-string design is rejected in the write-up. The relayer API receives (id, payee, sig) — **never the key**.
3. **Supabase:** RLS on every table, service key never in client bundle, run Security Advisor, test policies from two accounts.
4. **Claim lookup:** rate-limited (per-IP/session), keyed by keccak256(linkKey) (128-bit, never on-chain), no range/list queries, projection-only rows.
5. **Relayer wallet:** gas-only MON, no user funds, refuses to relay already-claimed escrows (pre-check), rate-limited per IP.
6. **Supply chain:** committed lockfile, `npm ci`, `npm audit` + Dependabot, pinned Action SHAs, minimal deps.