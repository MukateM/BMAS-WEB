create table if not exists public.site_analytics_events (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  event_type text not null default 'pageview',
  path text not null,
  title text,
  hostname text,
  referrer text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  visitor_id_hash text,
  session_id_hash text,
  device_type text,
  browser text,
  os text,
  country text,
  region text,
  city text,
  language text,
  screen_width integer,
  screen_height integer,
  viewport_width integer,
  viewport_height integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint site_analytics_events_event_type_check
    check (event_type in ('pageview', 'event', 'outbound_click'))
);

create index if not exists idx_site_analytics_events_occurred_at
  on public.site_analytics_events (occurred_at desc);

create index if not exists idx_site_analytics_events_path
  on public.site_analytics_events (path);

create index if not exists idx_site_analytics_events_visitor
  on public.site_analytics_events (visitor_id_hash);

alter table public.site_analytics_events enable row level security;

drop policy if exists "site_analytics_events_service_role_all" on public.site_analytics_events;
create policy "site_analytics_events_service_role_all"
  on public.site_analytics_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
