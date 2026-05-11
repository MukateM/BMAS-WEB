create or replace function public.get_quiz_leaderboard(p_limit integer default 10)
returns table (
  rank integer,
  name text,
  institution text,
  "userType" text,
  score numeric,
  "correctCount" integer,
  "totalQuestions" integer,
  level integer,
  duration integer,
  "attemptsCount" integer
)
language sql
security definer
set search_path = public
as $$
  with first_passes as (
    select distinct on (qa.user_id, qa.level)
      qa.user_id,
      qa.display_name,
      qa.score,
      qa.level,
      qa.duration_seconds,
      qa.submitted_at,
      qa.correct_count,
      qa.total_questions,
      qa.passed
    from public.quiz_attempts qa
    where qa.passed = true
    order by qa.user_id, qa.level, qa.submitted_at asc
  ),
  aggregated as (
    select
      fp.user_id,
      coalesce(qp.display_name, max(fp.display_name), 'Quiz member') as display_name,
      coalesce(qp.institution, 'Not specified') as institution_name,
      case
        when qp.user_type = 'employed' then 'employee'
        when qp.user_type = 'student' then 'student'
        else 'employee'
      end as user_type,
      max(fp.level)::integer as highest_level,
      sum(fp.correct_count)::integer as correct_count,
      sum(fp.total_questions)::integer as total_questions,
      sum(fp.duration_seconds)::integer as duration_seconds,
      count(*)::integer as attempts_count,
      max(fp.submitted_at) as last_submitted_at
    from first_passes fp
    left join public.quiz_profiles qp on qp.user_id = fp.user_id
    group by fp.user_id, qp.display_name, qp.institution, qp.user_type
  ),
  ranked as (
    select
      row_number() over (
        order by
          aggregated.highest_level desc,
          aggregated.correct_count desc,
          round((aggregated.correct_count::numeric / nullif(aggregated.total_questions, 0)), 4) desc,
          aggregated.duration_seconds asc,
          aggregated.last_submitted_at asc
      )::integer as rank,
      aggregated.display_name as name,
      aggregated.institution_name as institution,
      aggregated.user_type as "userType",
      coalesce(round((aggregated.correct_count::numeric / nullif(aggregated.total_questions, 0)), 4), 0) as score,
      aggregated.correct_count as "correctCount",
      aggregated.total_questions as "totalQuestions",
      aggregated.highest_level as level,
      aggregated.duration_seconds as duration,
      aggregated.attempts_count as "attemptsCount"
    from aggregated
  )
  select *
  from ranked
  order by rank
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

grant execute on function public.get_quiz_leaderboard(integer) to service_role;
