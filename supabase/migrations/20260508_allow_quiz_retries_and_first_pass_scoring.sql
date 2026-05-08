alter table public.quiz_attempts
  drop constraint if exists quiz_attempts_user_id_level_month_key_key;

drop index if exists public.quiz_attempts_user_id_level_month_key_key;

create index if not exists quiz_attempts_user_level_month_idx
  on public.quiz_attempts(user_id, level, month_key);
