-- Harden exposed functions flagged by the Supabase database linter.
-- SECURITY DEFINER RPCs are intended for trusted server/API usage only.

alter function public.set_updated_at()
  set search_path = public, pg_temp;

revoke execute on function public.set_updated_at()
  from public, anon, authenticated;

alter function public.capture_monthly_leaderboard(date)
  set search_path = public, pg_temp;

revoke execute on function public.capture_monthly_leaderboard(date)
  from public, anon, authenticated;

grant execute on function public.capture_monthly_leaderboard(date)
  to service_role;

alter function public.score_quiz_attempt(text[], smallint[])
  set search_path = public, pg_temp;

revoke execute on function public.score_quiz_attempt(text[], smallint[])
  from public, anon, authenticated;

grant execute on function public.score_quiz_attempt(text[], smallint[])
  to service_role;

alter function public.get_quiz_leaderboard(integer)
  set search_path = public, pg_temp;

revoke execute on function public.get_quiz_leaderboard(integer)
  from public, anon, authenticated;

grant execute on function public.get_quiz_leaderboard(integer)
  to service_role;

do $$
declare
  function_record record;
begin
  for function_record in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('arena_room_leaderboard')
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_arguments
    );
  end loop;
end;
$$;

do $$
declare
  function_record record;
begin
  for function_record in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('rls_auto_enable')
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_arguments
    );
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_arguments
    );
  end loop;
end;
$$;
