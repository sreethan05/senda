-- claims table + RLS — run in Supabase SQL Editor at TASK-403.
-- Supabase is an index only; it NEVER holds funds or keys.
-- Writes happen exclusively from server routes using SUPABASE_SECRET_KEY (bypasses RLS).

create table public.claims (
  id                uuid primary key default gen_random_uuid(),
  escrow_id         text not null unique,
  phone_hash        text not null,
  amount            bigint not null check (amount > 0),
  currency          text not null default 'AUSD',
  status            text not null default 'pending'
                      check (status in ('pending','claimed','cancelled')),
  sender_address    text not null,
  recipient_address text,
  created_at        timestamptz not null default now(),
  claimed_at        timestamptz
);

create index claims_phone_hash_idx on public.claims (phone_hash);
create index claims_status_idx     on public.claims (status);

-- Lock the table down: no anon policies for INSERT/UPDATE/DELETE,
-- and no blanket SELECT (prevents table enumeration by anyone with the
-- publishable key). Anon reads go through this single security-definer RPC:
create or replace function public.get_claim_by_escrow(p_escrow_id text)
returns public.claims
language sql
security definer
set search_path = public
as $$
  select * from public.claims where escrow_id = p_escrow_id limit 1;
$$;

grant execute on function public.get_claim_by_escrow(text) to anon, authenticated;
revoke all on public.claims from anon;

-- Client usage: supabase.rpc('get_claim_by_escrow', { p_escrow_id: id })
