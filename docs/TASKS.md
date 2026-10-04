# Tasks

Work ONE task at a time: implement → test → review → commit → mark complete. Target: **working product by Oct 11, video + submission Oct 12, deadline Oct 13.**

## Phase 1: Setup (Day 1 — Oct 4/5)
- [ ] TASK-101 Init Next.js + TypeScript + Tailwind in repo
- [ ] TASK-102 Configure env handling + `.env.example`, chain constants (143, AUSD address)
- [ ] TASK-103 Deploy placeholder Home screen to Vercel preview
- [ ] TASK-104 Acquire small amount of MON for mainnet gas (no faucet exists — buy/bridge)

## Phase 2: Auth (Day 2 — Oct 5)
- [ ] TASK-201 Integrate Mera: passkey creation → derived account
- [ ] TASK-202 Login/logout state, protected routes
- [ ] TASK-203 Dev-only burner wallet mode behind env flag
- [ ] TASK-204 Balance display: read AUSD balance of connected account
- [ ] TASK-205 Get test AUSD (bridge/testnet) for dev testing

## Phase 3: Contracts (Days 3–4 — Oct 6/7)
- [ ] TASK-301 Foundry init in `contracts/`, point at Monad testnet + mainnet
- [ ] TASK-302 `SendEscrow.sol`: `depositTo(phoneHash)` (AUSD transferFrom), `claim(escrowId)` (signature-bound to recipient), `cancel(escrowId)` (sender-only refund)
- [ ] TASK-303 Foundry tests: deposit, claim, cancel, double-claim, wrong-signature claim, reentrancy
- [ ] TASK-304 Deploy to testnet 10143, verify, run full manual loop
- [ ] TASK-305 Deploy to mainnet 143, verify, pin address in env

## Phase 4: Send flow (Day 5 — Oct 8)
- [ ] TASK-401 Amount input + phone input (E.164 validation, NGN preview)
- [ ] TASK-402 Approve + deposit transaction flow (pending → success + explorer link → error)
- [ ] TASK-403 Server route: store `{escrowId, phoneHash, amount, status}` in Supabase
- [ ] TASK-404 Generate claim link (`/claim/[id]`) + WhatsApp/SMS share deep link

## Phase 5: Claim flow (Day 6 — Oct 9)
- [ ] TASK-501 Claim landing page from link (amount, sender, big claim button)
- [ ] TASK-502 Passkey creation at claim time (Mera) for brand-new recipients
- [ ] TASK-503 Claim transaction + receipt screen (settlement time, fee, WU comparison)
- [ ] TASK-504 Sender cancel flow + refund receipt
- [ ] TASK-505 History list with status chips

## Phase 6: Demo polish (Day 7 — Oct 10)
- [ ] TASK-601 Receipt comparison: WU 6.4% / 8% vs senda fee + arrival bar
- [ ] TASK-602 NGN conversion display on every amount
- [ ] TASK-603 Empty/loading/error states pass across all screens
- [ ] TASK-604 PWA manifest + icon + name polish ("senda" lowercase branding)
- [ ] TASK-605 (stretch) Envio indexer for instant history
- [ ] TASK-606 (stretch) Aurora/NEAR Intents "add funds from any chain" button

## Phase 7: Demo + submission (Days 8–9 — Oct 11/12)
- [ ] TASK-701 Write 90-second demo script (two phones + stopwatch + WU comparison)
- [ ] TASK-702 Record video (plus backup takes of every critical path)
- [ ] TASK-703 Write project profile: demo, write-up (problem/moat/why-Monad), code link
- [ ] TASK-704 Fill bounty fields: Agora, Mera UX (+ Aurora if integrated)
- [ ] TASK-705 Submit by Oct 12 EOD — never Oct 13 night
