# Security Research (Oct 5, 2026) — ack3 prep, vulnerability matrix, test plan

Feeds TASK-307. ack3 (the $15K scan sponsor) = the Ackee Blockchain team (audited Monad, Lido, Aave, Safe; 237 audits, zero client hacks); they author the Wake framework. Their public methodology: (1) system modeling, (2) AI scan pinned to a scoped commit, (3) manual + agentic review (Wake static analyzer), (4) auditor-guided fuzzing. **To maximize the scan's value: pin a clean tagged commit, ship a threat-model doc, pre-run Slither/Aderyn with a triaged report, and land the invariant suite below — pre-existing invariants let their fuzzers attack your handler instead of rediscovering basics.**

## Vulnerability matrix (SendEscrow shape: depositTo(phoneHash, codeHash, amount, ttl) → claim(id, code, sig) → cancel / reclaim)

| Threat | Mitigated? | One-line test |
|---|---|---|
| Front-run claim (copy id+code+sig from mempool) | ✅ sig binds `payee` and must recover to `msg.sender` — copied claim reverts | Attacker replays stolen sig+code → revert |
| Signature malleability (EIP-2 high-s) | ✅ OZ5 `ECDSA.recover` rejects s > n/2 | Fuzz s' = n−s → revert |
| Replay across escrows / chains | ✅ digest carries `escrowId` + `codeHash`; EIP-712 domain pins chainId + contract | Replay escrow-A sig on B → revert |
| Code/sig binding mismatch (sig over different codeHash) | Must verify: signed codeHash == stored codeHash == keccak(submitted code) | Sign wrong codeHash, claim with real code → revert |
| Zero-amount deposit griefing | ⚠️ add explicit `amount > 0` (AUSD reverts ZeroAmount anyway; be explicit) | fuzz deposit(0) → revert |
| Claim/reclaim boundary race | ⚠️ define: claim iff `ts <= expiry`, reclaim iff `> expiry` | `vm.warp(exactExpiry)` claim passes; `warp(+1)` reclaim passes |
| Same-block deposit+reclaim (ttl=0) | ⚠️ add `ttl >= 10 minutes` minimum | deposit(ttl=0) → revert |
| uint96 overflow @ 6 decimals | ✅ uint96 ≈ 79e21 AUSD; Solidity 0.8 checked | fuzz max amounts |
| Fee-on-transfer token assumption | ✅ by scope: AUSD is plain ERC-20 — document assumption; use SafeERC20 | FoT mock: deposit 100, get 90 → documents behavior |
| Reentrancy (ERC-777-style hooks) | ✅ AUSD has no hooks + CEI + effects before transfer | reentrant mock reenters claim → no-op |
| ecrecover zero-address | ✅ OZ5 reverts | garbage sig → custom error |
| phoneHash brute-force (phone space feasible off-chain) | ⚠️ privacy not theft — code is useless without sig; salt lives only in the link fragment | document in threat model |
| Cancel/claim race (sender cancels while claim in flight) | ⚠️ policy decision: cancel allowed only pre-claim; last-tx-wins is acceptable — document | two-tx race test |
| Direct token donation breaks solvency | ✅ invariant is `balance >= sum(unclaimed)` (not ==) | handler donation → invariant holds |
| Upgrades/initializer | N/A immutable, no proxy | — |

## Foundry test list (1.5 days, solo)

**`test/unit/SendEscrow.t.sol`** — `test_Deposit_PullsTokensAndRecordsEscrow`, `test_Deposit_RevertZeroAmount`, `test_Deposit_RevertInsufficientAllowance`, `test_Deposit_RevertTtlBelowMinimum`, `test_Claim_HappyPath_PaysPayeeExactAmount`, `test_Claim_RevertWrongCode`, `test_Claim_RevertNotPayee_StolenSig`, `test_Claim_RevertMalleatedSig`, `test_Claim_RevertReplayOtherEscrow`, `test_Claim_RevertAfterExpiry`, `test_Claim_AtExactExpiryBoundary`, `test_Claim_RevertDoubleClaim`, `test_Claim_RevertSigWrongCodeHash`, `test_Cancel_OnlySender`, `test_Cancel_RevertAfterClaim`, `test_Reclaim_OnlyAfterExpiry_PaysSender`, `test_Reclaim_RevertTwice`, `test_ReentrantToken_RevertOnReentry`, `test_FeeOnTransferMock_AssumptionDocumented`

**`test/fuzz/SendEscrow.fuzz.t.sol`** — `fuzz_DepositClaimRoundTrip(uint96,uint256 seed)`, `fuzz_NoClaimWithoutValidSig(address,uint256,uint256)`, `fuzz_WrongCodeNeverClaims(bytes)`

**`test/invariants/`** — handler with actors (deposit / claim w/ sender-signed sig / cancel / reclaim / warp) + ghost variable `escrowedTotal`:
`invariant_Solvency_BalanceGeEscrowedTotal`, `invariant_NoDoublePayout` (per-id state machine pending→claimed|cancelled|reclaimed, terminal sticky), `invariant_SenderNeverLosesMoreThanDeposited`

**`test/fork/SendEscrowFork.t.sol`** — `fork_Claim_RawAusd6Decimals` (fork Monad testnet at real AUSD address), `fork_E2E_FrontendDerivedSigClaims` (produce the EIP-712 digest **exactly as the Next.js client does** — catches domain name/version/chainId mismatch, the #1 integration bug)

**Gas:** `forge snapshot --snap .gas-snapshot`, commit it, `--diff` in CI. Total ≈ 27 tests → `forge coverage` stat goes on the final slide.

## Static analysis

```bash
pip install slither-analyzer && slither . --exclude-informational
cargo install --git https://github.com/Cyfrin/aderyn && aderyn .   # or release binary
```
Fix: unchecked ERC-20 returns (use SafeERC20), missing amount/ttl validation. Triage with written justification: reentrancy-events false positive under CEI + plain ERC-20, centralization on sender cancel (product intent), naming/pragma NCs. Plain-EVM source analysis — no Monad compatibility work needed; only fork tests need the RPC.

## Frontend security checklist (write-up section)

1. **Passkey phishing:** rpId binds credentials to the registrable domain — a lookalike site cannot invoke the user's passkey (WebAuthn spec). Scope: protects the ceremony, not session cookies → HttpOnly/Secure/SameSite cookies.
2. **Link tampering:** claim code in the **URL fragment** — fragments are never transmitted to any server (RFC 9110 §7.3), so Supabase/CDN/proxy logs never see the secret. Acknowledge: fragments persist in history/screenshots; keep out of referrer. Query-string design is rejected in the write-up.
3. **Supabase:** RLS on every table, service key never in client bundle, run Security Advisor, test policies from two accounts.
4. **Claim lookup:** rate-limited (per-IP/session), phoneHash format-validated, no range/list queries.
5. **Supply chain:** committed lockfile, `npm ci`, `npm audit` + Dependabot, pinned Action SHAs, minimal deps.