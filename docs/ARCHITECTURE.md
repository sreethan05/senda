# Architecture

## Frontend
Next.js (App Router) + TypeScript + Tailwind CSS. Mobile-first PWA — must look native inside a phone browser for the demo video.

## Authentication
Mera (`@category-labs/mera`) — WebAuthn passkey with PRF extension → locally derived EVM account. Mera is the ONLY account layer in production. A plain burner wallet (env-configured) exists solely for local dev and seeding.

## Chain
- **Monad mainnet** — chain ID `143`, RPC `https://rpc.monad.xyz`, explorer `monadscan.com`, native token MON.
- **Stablecoin:** AUSD (Agora), decimals 6, mainnet address `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` (per docs.agora.finance contract deployments).
- **Contracts:** Foundry project in `contracts/`. One main contract: `SendEscrow.sol`.

## Database
Supabase PostgreSQL — an **index only**, never a custodian:
- `claims` table: escrow id, phone hash, amount, status (`pending | claimed | cancelled`), created/expires timestamps.
- No private keys, no mnemonics, no PII beyond a salted phone hash.

## Money Flow
```
Sender (passkey EOA)
   │  1. approve AUSD + depositTo(phoneHash, codeHash, amount, ttl)
   ▼
SendEscrow.sol (Monad 143) ── funds locked
   │
   ├─ 2. app stores {escrowId, phoneHash} in Supabase, renders claim link
   │     link carries: /claim/[id]#code=XXXXXX&salt=…   ("SMS" = opening link on phone 2)
   ▼
Recipient opens link
   │  3. creates passkey (Mera) → EOA; signs EIP-712 Claim(escrowId, codeHash, payee)
   ▼
Recipient account
   │  4. claim(id, code, sig) — codeHash match + ecrecover(sig) == msg.sender == payee
   ▼
AUSD released instantly (~1s finality)
```
Cancel: sender can `cancel(id)` before claim → refund. Expiry: `reclaim(id)` bounces unclaimed funds to sender after `ttl` — nothing can strand. Claim is front-running-fund-neutral (signature binds the payee). Full design rationale: [RESEARCH_TECH.md](RESEARCH_TECH.md) §3.

## Deployment
Vercel (preview → production). Contracts deployed to Monad testnet first (`10143`), then mainnet; addresses pinned in `.env`.

## Folder Structure
```
senda/
├── docs/
├── contracts/          # Foundry: src/, test/, script/
├── src/
│   ├── app/            # routes: /, /send, /claim/[id], /history, /receipt/[id]
│   ├── components/     # reusable UI (Button, Card, AmountInput, PhoneInput...)
│   ├── features/       # send/, claim/, auth/, balance/
│   ├── services/       # supabase queries, claim API routes
│   ├── lib/chain/      # ALL chain calls (escrow, AUSD, mera) live here
│   ├── lib/            # config, constants (addresses, chain), format utils
│   └── types/
├── tests/              # e2e (Playwright)
├── .env.example
└── README.md
```

## Architectural Rules
- UI components contain NO chain/database logic.
- All contract calls go through `src/lib/chain/` services — one module per contract.
- Supabase writes happen only in server routes/API actions, never from client components.
- Addresses and chain IDs come from env, never hardcoded.
- The escrow contract is the only place user funds ever exist.
