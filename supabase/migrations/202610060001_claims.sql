create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  escrow_id text not null unique,
  key_hash text not null unique,
  amount bigint not null check (amount > 0),
  currency text not null default 'AUSD',
  status text not null default 'pending',
  sender_address text not null,
  recipient_address text,
  deposit_tx_hash text,
  expires_at bigint not null,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

alter table public.claims add column if not exists deposit_tx_hash text;
alter table public.claims add column if not exists expires_at bigint;
alter table public.claims alter column expires_at set default 0;

alter table public.claims drop constraint if exists claims_status_check;
alter table public.claims add constraint claims_status_check
  check (status in ('pending', 'claimed', 'cancelled', 'expired', 'refunded'));

create index if not exists claims_sender_created_idx on public.claims (sender_address, created_at desc);
create index if not exists claims_status_idx on public.claims (status);

alter table public.claims enable row level security;
revoke all on public.claims from anon, authenticated;
grant select, insert, update on public.claims to service_role;
