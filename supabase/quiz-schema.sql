create extension if not exists pgcrypto;

create table if not exists public.quiz_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alias text not null unique,
  current_level smallint not null default 1 check (current_level between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.quiz_profiles(user_id) on delete cascade,
  display_alias text not null,
  level smallint not null check (level between 1 and 3),
  month_key date not null,
  score numeric(5,4) not null check (score >= 0 and score <= 1),
  passed boolean not null,
  correct_count integer not null check (correct_count >= 0),
  total_questions integer not null check (total_questions > 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  submitted_at timestamptz not null default now(),
  unique (user_id, level, month_key)
);

create index if not exists quiz_attempts_month_key_idx on public.quiz_attempts(month_key);
create index if not exists quiz_attempts_user_id_idx on public.quiz_attempts(user_id);

create table if not exists public.leaderboard_monthly_snapshot (
  id uuid primary key default gen_random_uuid(),
  month_key date not null,
  rank integer not null check (rank > 0),
  display_alias text not null,
  score numeric(5,4) not null check (score >= 0 and score <= 1),
  level smallint not null check (level between 1 and 3),
  captured_at timestamptz not null default now()
);

create index if not exists leaderboard_monthly_snapshot_month_key_idx on public.leaderboard_monthly_snapshot(month_key desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quiz_profiles_set_updated_at on public.quiz_profiles;
create trigger quiz_profiles_set_updated_at
before update on public.quiz_profiles
for each row execute function public.set_updated_at();

alter table public.quiz_profiles enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.leaderboard_monthly_snapshot enable row level security;

drop policy if exists "profiles_select_own" on public.quiz_profiles;
create policy "profiles_select_own"
on public.quiz_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.quiz_profiles;
create policy "profiles_insert_own"
on public.quiz_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.quiz_profiles;
create policy "profiles_update_own"
on public.quiz_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "attempts_select_own" on public.quiz_attempts;
create policy "attempts_select_own"
on public.quiz_attempts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "attempts_insert_own" on public.quiz_attempts;
create policy "attempts_insert_own"
on public.quiz_attempts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "attempts_public_leaderboard_read" on public.quiz_attempts;
create policy "attempts_public_leaderboard_read"
on public.quiz_attempts
for select
to anon, authenticated
using (true);

drop policy if exists "snapshots_public_read" on public.leaderboard_monthly_snapshot;
create policy "snapshots_public_read"
on public.leaderboard_monthly_snapshot
for select
to anon, authenticated
using (true);

create or replace function public.capture_monthly_leaderboard(target_month date default date_trunc('month', now())::date)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.leaderboard_monthly_snapshot where month_key = target_month;

  insert into public.leaderboard_monthly_snapshot (month_key, rank, display_alias, score, level)
  select
    ranked.month_key,
    row_number() over (
      order by ranked.score desc, ranked.level desc, ranked.duration_seconds asc, ranked.submitted_at asc
    ) as rank,
    ranked.display_alias,
    ranked.score,
    ranked.level
  from (
    select distinct on (qa.display_alias)
      qa.month_key,
      qa.display_alias,
      qa.score,
      qa.level,
      qa.duration_seconds,
      qa.submitted_at
    from public.quiz_attempts qa
    where qa.month_key = target_month
    order by qa.display_alias, qa.score desc, qa.level desc, qa.duration_seconds asc, qa.submitted_at asc
  ) ranked;
end;
$$;

comment on function public.capture_monthly_leaderboard(date)
is 'Run this at month end with Supabase cron or a scheduled function to archive monthly winners.';
