-- Resolve remaining Supabase db lint findings after function hardening.

alter table public.leaderboard_monthly_snapshot
  add column if not exists display_name text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leaderboard_monthly_snapshot'
      and column_name = 'display_alias'
  ) then
    execute '
      update public.leaderboard_monthly_snapshot
      set display_name = display_alias
      where display_name is null
    ';
  end if;
end;
$$;

alter table public.leaderboard_monthly_snapshot
  alter column display_name set default 'Quiz member';

update public.leaderboard_monthly_snapshot
set display_name = 'Quiz member'
where display_name is null;

alter table public.leaderboard_monthly_snapshot
  alter column display_name set not null;

create or replace function public.score_quiz_attempt(
  p_question_ids text[],
  p_answers smallint[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_correct int := 0;
  v_total int := array_length(p_question_ids, 1);
  v_question record;
  v_answer smallint;
  v_is_correct boolean;
begin
  for question_index in 1 .. v_total loop
    select * into v_question
    from public.quiz_questions
    where id = p_question_ids[question_index];

    if not found then
      raise exception 'Question not found: %', p_question_ids[question_index];
    end if;

    v_answer := p_answers[question_index];
    v_is_correct := (v_answer is not null and v_answer = v_question.correct_index);

    if v_is_correct then
      v_correct := v_correct + 1;
    end if;

    v_result := v_result || jsonb_build_object(
      'id', v_question.id,
      'is_correct', v_is_correct,
      'correct_index', v_question.correct_index,
      'explanation', v_question.explanation,
      'act_reference', v_question.act_reference,
      'case_reference', v_question.case_reference,
      'correct_option', case v_question.correct_index
        when 0 then v_question.option_a
        when 1 then v_question.option_b
        when 2 then v_question.option_c
        when 3 then v_question.option_d
      end
    );
  end loop;

  return jsonb_build_object(
    'correct_count', v_correct,
    'total_questions', v_total,
    'raw_score', case when v_total > 0 then round((v_correct::numeric / v_total), 4) else 0 end,
    'passed', case when v_total > 0 then (v_correct::numeric / v_total) >= 0.5 else false end,
    'details', v_result
  );
end;
$$;

revoke execute on function public.score_quiz_attempt(text[], smallint[])
  from public, anon, authenticated;

grant execute on function public.score_quiz_attempt(text[], smallint[])
  to service_role;

create or replace function public.capture_monthly_leaderboard(target_month date default date_trunc('month', now())::date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.leaderboard_monthly_snapshot where month_key = target_month;

  insert into public.leaderboard_monthly_snapshot (month_key, rank, display_name, score, level)
  select
    ranked.month_key,
    row_number() over (
      order by ranked.level desc, ranked.correct_count desc, ranked.score desc, ranked.duration_seconds asc, ranked.last_submitted_at asc
    ) as rank,
    ranked.display_name,
    ranked.score,
    ranked.level
  from (
    with first_passes as (
      select distinct on (qa.user_id, qa.level)
        qa.user_id,
        qa.month_key,
        qa.display_name,
        qa.level,
        qa.score,
        qa.correct_count,
        qa.total_questions,
        qa.duration_seconds,
        qa.submitted_at
      from public.quiz_attempts qa
      where qa.month_key = target_month
        and qa.passed = true
      order by qa.user_id, qa.level, qa.submitted_at asc
    )
    select
      fp.month_key,
      fp.display_name,
      max(fp.level) as level,
      round((sum(fp.correct_count)::numeric / nullif(sum(fp.total_questions), 0)), 4) as score,
      sum(fp.correct_count) as correct_count,
      sum(fp.duration_seconds) as duration_seconds,
      max(fp.submitted_at) as last_submitted_at
    from first_passes fp
    group by fp.month_key, fp.user_id, fp.display_name
  ) ranked;
end;
$$;

revoke execute on function public.capture_monthly_leaderboard(date)
  from public, anon, authenticated;

grant execute on function public.capture_monthly_leaderboard(date)
  to service_role;
