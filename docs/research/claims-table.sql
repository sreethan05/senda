-- claims table + RLS — v3, Linkdrop-style link-key design (run at TASK-403).
-- Supabase is an index only; it NEVER holds funds, keys, or the link key.
-- Writes happen exclusively from server routes using SUPABASE_SECRET_KEY (bypasses RLS).
--
-- Enumeration fix: anon lookups are keyed by keccak256(linkKey) — a 128-bit
-- value that never appears on-chain and is never sent to the relayer — NOT by
-- sequential escrow_id. Rows return a minimal projection only (no raw
-- addresses, no key material).

create table public.claims (
  id                uuid primary key default gen_random_uuid(),
  escrow_id         text not null unique,
  key_hash          text not null unique,      -- keccak256 hex of the ephemeral link key
  amount            bigint not null check (amount > 0),
  currency          text not null default 'AUSD',
  status            text not null default 'pending'
                      check (status in ('pending','claimed','cancelled','expired')),
  sender_address    text not null,
  recipient_address text,
  created_at        timestamptz not null default now(),
  settled_at        timestamptz                 -- claimed_at OR cancelled_at
);

create index claims_key_hash_idx on public.claims (key_hash);
create index claims_status_idx   on public.claims (status);

-- Lock the table down: no anon policies for INSERT/UPDATE/DELETE, and no
-- blanket SELECT. Anon (the claim page) reads ONLY through this security
-- definer RPC, keyed by the link key's hash, returning a PROJECTION —
-- knowing an escrow_id alone (sequential, public on-chain) reveals nothing.
create or replace function public.get_claim_by_key(p_key_hash text)
returns table (
  amount      bigint,
  currency    text,
  status      text,
  created_at  timestamptz,
  sender_hint text                            -- e.g. '0x••••4821' — last 4 hex of the sender address
)
language sql
security definer
set search_path = public
as $$
  select c.amount, c.currency, c.status, c.created_at,
         '0x••••' || right(c.sender_address, 4)
  from public.claims c
  where c.key_hash = p_key_hash
  limit 1;
$$;

grant execute on function public.get_claim_by_key(text) to anon, authenticated;
revoke all on public.claims from anon;

-- Client usage: supabase.rpc('get_claim_by_key', { p_key_hash })
-- (status flips to 'expired' when the relayer/reclaimer observes expiry on-chain.)
