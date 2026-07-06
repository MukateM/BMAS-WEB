create table if not exists public.document_asset_pages (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.document_products(id) on delete cascade,
  title text not null default '',
  storage_bucket text not null default 'resource-library',
  storage_path text not null,
  page_number integer not null check (page_number > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, page_number)
);

create index if not exists document_asset_pages_product_order_idx
  on public.document_asset_pages (product_id, is_active, page_number);

alter table public.document_asset_pages enable row level security;

drop policy if exists "document_asset_pages_service_role_all" on public.document_asset_pages;
create policy "document_asset_pages_service_role_all"
  on public.document_asset_pages
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop trigger if exists set_document_asset_pages_updated_at on public.document_asset_pages;
create trigger set_document_asset_pages_updated_at
  before update on public.document_asset_pages
  for each row
  execute function public.set_document_orders_updated_at();
