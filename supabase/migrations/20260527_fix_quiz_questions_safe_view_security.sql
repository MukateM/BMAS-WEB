-- Supabase linter 0010: avoid SECURITY DEFINER views.
-- The app uses server APIs for quiz questions, but this compatibility view
-- should still execute with the querying user's permissions.

drop view if exists public.quiz_questions_safe;

create view public.quiz_questions_safe
with (security_invoker = true) as
  select
    id,
    level,
    scenario,
    question,
    option_a,
    option_b,
    option_c,
    option_d,
    active
  from public.quiz_questions;

grant select on public.quiz_questions_safe to anon, authenticated;
