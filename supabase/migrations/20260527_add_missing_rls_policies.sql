-- Supabase linter 0008: RLS enabled with no policies.
-- These tables should not be directly readable from the browser. The policies
-- below make the intent explicit and keep access limited to trusted server code.

do $$
begin
  if to_regclass('public.quiz_manual_users') is not null then
    execute 'drop policy if exists "Service role can manage manual quiz users" on public.quiz_manual_users';
    execute $policy$create policy "Service role can manage manual quiz users"
      on public.quiz_manual_users
      for all
      to service_role
      using (true)
      with check (true)$policy$;
  end if;

  if to_regclass('public.arena_rooms') is not null then
    execute 'drop policy if exists "Service role can manage arena rooms" on public.arena_rooms';
    execute $policy$create policy "Service role can manage arena rooms"
      on public.arena_rooms
      for all
      to service_role
      using (true)
      with check (true)$policy$;
  end if;

  if to_regclass('public.arena_room_questions') is not null then
    execute 'drop policy if exists "Service role can manage arena room questions" on public.arena_room_questions';
    execute $policy$create policy "Service role can manage arena room questions"
      on public.arena_room_questions
      for all
      to service_role
      using (true)
      with check (true)$policy$;
  end if;
end $$;
