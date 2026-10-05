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
- `claims` table: escrow id, key hash (keccak256 of the link key — the anon lookup key), amount, status (`pending | claimed | cancelled | expired`), created/settled timestamps.
- No private keys, no mnemonics, no link keys, no raw phone numbers — the phone number routes where the link is *sent* (app layer only) and is never stored.

## Money Flow
```
Sender (passkey EOA)
   │  app generates a 32-byte ephemeral LINK KEY client-side
   │  1. approve AUSD + depositTo(linkKeyAddress, amount, ttl)
   ▼
SendEscrow.sol (Monad 143) ── funds locked against the link key's ADDRESS
   │
   ├─ 2. app stores {escrowId, keyHash} in Supabase, renders claim link
   │     link = /claim/[id]#k=<link key hex>   (private key lives ONLY in the fragment)
   ▼
Recipient opens link
   │  3. creates passkey (Mera) → payee account
   │     app signs Claim(escrowId, payee) WITH THE LINK KEY (client-side, no gas)
   ▼
senda relayer (server wallet — pays gas, learns only id+payee+signature)
   │  4. claim(id, payee, sig) — recover(sig) == stored linkKey → pays payee
   ▼
AUSD lands in the recipient's passkey account (~1s finality)
```
**Why the relayer can't steal:** it never sees the link key — only a signature over a fixed payee. Forging a signature for any other destination requires the key. Replaying observed calldata pays the same payee. Possession of the link = possession of the key = ownership (documented Linkdrop analogy).
Cancel: sender can `cancel(id)` before claim → refund. Expiry: `reclaim(id)` bounces unclaimed funds to the sender after `ttl` — nothing can strand. Full design rationale: [RESEARCH_TECH.md](RESEARCH_TECH.md) §3.

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
