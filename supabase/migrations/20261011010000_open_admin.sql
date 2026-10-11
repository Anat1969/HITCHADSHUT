-- Open admin: management of "מה נבנה סביבי" without login, at the owner's request.
-- Scope is limited to the plan_* tables and the plan-media bucket. The shared staff
-- account and is_staff() of other city systems are NOT touched.
-- To restore login-only management: drop every policy whose name starts with "open admin".

create policy "open admin read projects" on public.plan_projects for select to anon using (true);
create policy "open admin insert projects" on public.plan_projects for insert to anon with check (true);
create policy "open admin update projects" on public.plan_projects for update to anon using (true) with check (true);
create policy "open admin delete projects" on public.plan_projects for delete to anon using (true);

create policy "open admin read media" on public.plan_media for select to anon using (true);
create policy "open admin insert media" on public.plan_media for insert to anon with check (true);
create policy "open admin update media" on public.plan_media for update to anon using (true) with check (true);
create policy "open admin delete media" on public.plan_media for delete to anon using (true);

create policy "open admin read feedback" on public.plan_feedback for select to anon using (true);
create policy "open admin update feedback" on public.plan_feedback for update to anon using (true) with check (true);
create policy "open admin delete feedback" on public.plan_feedback for delete to anon using (true);

create policy "open admin read files" on storage.objects for select to anon using (bucket_id = 'plan-media');
create policy "open admin insert files" on storage.objects for insert to anon with check (bucket_id = 'plan-media');
create policy "open admin update files" on storage.objects for update to anon using (bucket_id = 'plan-media');
create policy "open admin delete files" on storage.objects for delete to anon using (bucket_id = 'plan-media');
