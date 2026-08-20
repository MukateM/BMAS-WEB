alter table public.leads
  add column if not exists service_interest text,
  add column if not exists message text,
  add column if not exists source text not null default 'website',
  add column if not exists status text not null default 'new',
  add column if not exists consent boolean not null default false,
  add column if not exists page_url text,
  add column if not exists referrer text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists assigned_to text,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost'));

create index if not exists leads_status_created_at_idx on public.leads (status, created_at desc);
create index if not exists leads_next_follow_up_idx on public.leads (next_follow_up_at)
  where status not in ('won', 'lost');

drop policy if exists "Service role manages leads" on public.leads;
create policy "Service role manages leads" on public.leads
  for all to service_role
  using (true)
  with check (true);
