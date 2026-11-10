-- FRAMIQ: pedidos de orçamento e gestão de pagamentos
-- Cole este ficheiro no SQL Editor do Supabase e execute uma vez.

create extension if not exists pgcrypto;

-- Quem pode gerir pedidos (emails dos gestores)
create table if not exists public.managers (
  email text primary key
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  site_type text check (char_length(site_type) <= 80),
  message text check (char_length(message) <= 3000),
  status text not null default 'novo' check (status in ('novo','confirmado','pago','recusado')),
  amount_cents integer check (amount_cents is null or amount_cents between 100 and 10000000),
  manager_note text,
  pay_token uuid not null default gen_random_uuid() unique,
  confirmed_at timestamptz,
  email_sent_at timestamptz,
  paid_at timestamptz,
  stripe_session_id text
);

create index if not exists orders_status_idx on public.orders (status, created_at desc);

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.managers m where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

alter table public.orders enable row level security;
alter table public.managers enable row level security;

-- Visitantes do site só podem criar pedidos (nunca ler nem alterar)
revoke all on public.orders from anon, authenticated;
grant insert (name, email, site_type, message) on public.orders to anon;
grant select, update on public.orders to authenticated;

drop policy if exists "site cria pedidos" on public.orders;
create policy "site cria pedidos" on public.orders for insert to anon
  with check (status = 'novo' and amount_cents is null);

drop policy if exists "gestor le pedidos" on public.orders;
create policy "gestor le pedidos" on public.orders for select to authenticated
  using (public.is_manager());

drop policy if exists "gestor altera pedidos" on public.orders;
create policy "gestor altera pedidos" on public.orders for update to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- A tabela de gestores só é gerida no painel do Supabase
revoke all on public.managers from anon, authenticated;

-- Depois de correr este ficheiro, adicione o seu email de gestor:
-- insert into public.managers (email) values ('o-seu-email@exemplo.pt');
