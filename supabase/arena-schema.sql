create extension if not exists pgcrypto;

create table if not exists public.arena_rooms (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  join_code text not null unique,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'paused', 'closed')),
  current_question_index integer not null default 0 check (current_question_index >= 0),
  started_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arena_rooms_host_idx on public.arena_rooms(host_user_id, created_at desc);
create index if not exists arena_rooms_join_code_idx on public.arena_rooms(join_code);

create table if not exists public.arena_room_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.arena_rooms(id) on delete cascade,
  position integer not null check (position > 0),
  prompt text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_index smallint not null check (correct_index between 0 and 3),
  time_limit_seconds integer not null default 20 check (time_limit_seconds between 5 and 120),
  weight numeric(8,2) not null default 100 check (weight > 0),
  created_at timestamptz not null default now(),
  unique(room_id, position)
);

create index if not exists arena_questions_room_idx on public.arena_room_questions(room_id, position);

create table if not exists public.arena_room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.arena_rooms(id) on delete cascade,
  display_name text not null,
  normalized_display_name text not null,
  organization text not null,
  joined_at timestamptz not null default now(),
  unique(room_id, normalized_display_name)
);

create index if not exists arena_participants_room_idx on public.arena_room_participants(room_id, joined_at);

create table if not exists public.arena_question_submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.arena_rooms(id) on delete cascade,
  question_id uuid not null references public.arena_room_questions(id) on delete cascade,
  participant_id uuid not null references public.arena_room_participants(id) on delete cascade,
  selected_option smallint not null check (selected_option between 0 and 3),
  response_ms integer not null default 0 check (response_ms >= 0),
  is_correct boolean not null default false,
  accuracy_score numeric(10,4) not null default 0,
  speed_score numeric(10,4) not null default 0,
  total_score numeric(10,4) not null default 0,
  submitted_at timestamptz not null default now(),
  unique(question_id, participant_id)
);

create index if not exists arena_submissions_room_idx on public.arena_question_submissions(room_id, participant_id);
create index if not exists arena_submissions_question_idx on public.arena_question_submissions(question_id);

create or replace function public.arena_room_leaderboard(target_room_id uuid)
returns table(
  participant_id uuid,
  display_name text,
  organization text,
  total_accuracy numeric,
  total_speed numeric,
  grand_total numeric,
  total_response_ms bigint,
  submissions_count bigint,
  rank bigint
)
language sql
stable
as $$
  with score_rows as (
    select
      p.id as participant_id,
      p.display_name,
      p.organization,
      coalesce(sum(s.accuracy_score), 0)::numeric as total_accuracy,
      coalesce(sum(s.speed_score), 0)::numeric as total_speed,
      coalesce(sum(s.total_score), 0)::numeric as grand_total,
      coalesce(sum(s.response_ms), 0)::bigint as total_response_ms,
      count(s.id)::bigint as submissions_count
    from public.arena_room_participants p
    left join public.arena_question_submissions s
      on s.participant_id = p.id and s.room_id = p.room_id
    where p.room_id = target_room_id
    group by p.id, p.display_name, p.organization
  )
  select
    sr.participant_id,
    sr.display_name,
    sr.organization,
    sr.total_accuracy,
    sr.total_speed,
    sr.grand_total,
    sr.total_response_ms,
    sr.submissions_count,
    rank() over (
      order by sr.total_accuracy desc, sr.total_response_ms asc, sr.grand_total desc, sr.participant_id asc
    ) as rank
  from score_rows sr
  order by rank asc;
$$;

alter table public.arena_rooms enable row level security;
alter table public.arena_room_questions enable row level security;
alter table public.arena_room_participants enable row level security;
alter table public.arena_question_submissions enable row level security;

drop policy if exists "arena_public_participants_read" on public.arena_room_participants;
create policy "arena_public_participants_read"
on public.arena_room_participants
for select
to anon, authenticated
using (true);

drop policy if exists "arena_public_submissions_read" on public.arena_question_submissions;
create policy "arena_public_submissions_read"
on public.arena_question_submissions
for select
to anon, authenticated
using (true);
