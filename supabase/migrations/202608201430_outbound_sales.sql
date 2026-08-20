create table if not exists public.sales_prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  job_title text,
  email text not null,
  website text,
  industry text,
  location text,
  employee_range text,
  service_interest text,
  source_url text,
  qualification_reason text,
  status text not null default 'research',
  email_subject text,
  email_body text,
  approved_at timestamptz,
  approved_by uuid,
  sent_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email),
  constraint sales_prospects_status_check check (status in ('research','draft','approved','sent','replied','qualified','won','lost','suppressed'))
);

create table if not exists public.sales_suppressions (
  email text primary key,
  reason text not null default 'unsubscribe',
  created_at timestamptz not null default now()
);

alter table public.sales_prospects enable row level security;
alter table public.sales_suppressions enable row level security;

drop policy if exists "Service role manages prospects" on public.sales_prospects;
create policy "Service role manages prospects" on public.sales_prospects for all to service_role using (true) with check (true);
drop policy if exists "Service role manages suppressions" on public.sales_suppressions;
create policy "Service role manages suppressions" on public.sales_suppressions for all to service_role using (true) with check (true);

create index if not exists sales_prospects_status_created_idx on public.sales_prospects (status, created_at desc);
