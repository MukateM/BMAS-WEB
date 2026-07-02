drop policy if exists "Authenticated users can read active document assets" on public.document_assets;

drop policy if exists "document_assets_service_role_all" on public.document_assets;
create policy "document_assets_service_role_all"
  on public.document_assets
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
