create table if not exists public.document_products (
  id text primary key,
  title text not null,
  category text not null,
  price numeric(12, 2) not null check (price >= 0),
  currency text not null default 'ZMW',
  summary text not null default '',
  best_for text not null default '',
  format text not null default '',
  delivery text not null default 'Available in your BMAS Library after payment confirmation',
  includes text[] not null default '{}',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_products_active_order_idx
  on public.document_products (is_active, display_order, title);

create table if not exists public.document_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  product_id text not null,
  product_title text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'ZMW',
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider text not null default 'lipila',
  provider_reference text,
  provider_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists document_orders_customer_email_idx
  on public.document_orders (customer_email);

create index if not exists document_orders_user_id_idx
  on public.document_orders (user_id);

create index if not exists document_orders_status_idx
  on public.document_orders (status);

create table if not exists public.document_assets (
  id uuid primary key default gen_random_uuid(),
  product_id text not null unique,
  title text not null,
  storage_bucket text not null default 'resource-library',
  storage_path text not null,
  page_count integer not null default 0 check (page_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_products enable row level security;
alter table public.document_orders enable row level security;
alter table public.document_assets enable row level security;

drop policy if exists "Public can read active document products" on public.document_products;
create policy "Public can read active document products"
  on public.document_products
  for select
  using (is_active = true);

drop policy if exists "document_products_service_role_all" on public.document_products;
create policy "document_products_service_role_all"
  on public.document_products
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "document_orders_service_role_all" on public.document_orders;
create policy "document_orders_service_role_all"
  on public.document_orders
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Users can read own document orders" on public.document_orders;
create policy "Users can read own document orders"
  on public.document_orders
  for select
  using (auth.uid() = user_id);

drop policy if exists "document_assets_service_role_all" on public.document_assets;
create policy "document_assets_service_role_all"
  on public.document_assets
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Authenticated users can read active document assets" on public.document_assets;

create or replace function public.set_document_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_document_orders_updated_at on public.document_orders;
create trigger set_document_orders_updated_at
  before update on public.document_orders
  for each row
  execute function public.set_document_orders_updated_at();

drop trigger if exists set_document_products_updated_at on public.document_products;
create trigger set_document_products_updated_at
  before update on public.document_products
  for each row
  execute function public.set_document_orders_updated_at();

drop trigger if exists set_document_assets_updated_at on public.document_assets;
create trigger set_document_assets_updated_at
  before update on public.document_assets
  for each row
  execute function public.set_document_orders_updated_at();
