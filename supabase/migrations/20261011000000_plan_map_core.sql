-- "מה נבנה סביבי" — applied to Supabase project ASHDODMAP (cbhexpybdggwzyakgagd) on 2026-10-11.
-- Additive: relies on existing public.quarters, public.staff and public.is_staff() from the same project.

create table public.plan_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 200),
  kind text not null default 'urban_renewal'
    check (kind in ('urban_renewal','new_construction','public_building','public_space','infrastructure')),
  renewal_track text check (renewal_track is null or renewal_track in ('pinui_binui','tama38','other')),
  status text not null default 'planning'
    check (status in ('planning','approved','permit','construction','completed')),
  plan_number text,
  quarter_id text references public.quarters(id) on delete set null,
  address text,
  summary text,
  description text,
  public_benefits text,
  units_existing integer check (units_existing is null or units_existing >= 0),
  units_planned integer check (units_planned is null or units_planned >= 0),
  floors text,
  expected_completion text,
  developer text,
  contact_info text,
  geojson jsonb,
  center jsonb,
  cover_media_id uuid,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.plan_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.plan_projects(id) on delete cascade,
  kind text not null check (kind in ('render','video','video_link','kml','document')),
  storage_path text,
  url text,
  caption text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  check (storage_path is not null or url is not null)
);

alter table public.plan_projects
  add constraint plan_projects_cover_fk foreign key (cover_media_id) references public.plan_media(id) on delete set null;

create table public.plan_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.plan_projects(id) on delete cascade,
  kind text not null default 'question' check (kind in ('question','support','concern','idea')),
  body text not null check (char_length(btrim(body)) between 3 and 2000),
  author_name text check (author_name is null or char_length(author_name) <= 80),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index plan_projects_published_idx on public.plan_projects (published);
create index plan_projects_quarter_idx on public.plan_projects (quarter_id);
create index plan_media_project_idx on public.plan_media (project_id, sort);
create index plan_feedback_project_idx on public.plan_feedback (project_id, status);

create or replace function public.plan_touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

create trigger plan_projects_touch before update on public.plan_projects
for each row execute function public.plan_touch_updated_at();

alter table public.plan_projects enable row level security;
alter table public.plan_media enable row level security;
alter table public.plan_feedback enable row level security;

create policy "plan_projects public read" on public.plan_projects
  for select to anon, authenticated using (published or (select public.is_staff()));
create policy "plan_projects staff insert" on public.plan_projects
  for insert to authenticated with check ((select public.is_staff()));
create policy "plan_projects staff update" on public.plan_projects
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "plan_projects staff delete" on public.plan_projects
  for delete to authenticated using ((select public.is_staff()));

create policy "plan_media public read" on public.plan_media
  for select to anon, authenticated
  using (exists (select 1 from public.plan_projects p where p.id = project_id and p.published) or (select public.is_staff()));
create policy "plan_media staff insert" on public.plan_media
  for insert to authenticated with check ((select public.is_staff()));
create policy "plan_media staff update" on public.plan_media
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "plan_media staff delete" on public.plan_media
  for delete to authenticated using ((select public.is_staff()));

create policy "plan_feedback read approved" on public.plan_feedback
  for select to anon, authenticated using (status = 'approved' or (select public.is_staff()));
create policy "plan_feedback resident insert" on public.plan_feedback
  for insert to anon, authenticated
  with check (
    status = 'pending' and reply is null and replied_at is null
    and exists (select 1 from public.plan_projects p where p.id = project_id and p.published)
  );
create policy "plan_feedback staff update" on public.plan_feedback
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "plan_feedback staff delete" on public.plan_feedback
  for delete to authenticated using ((select public.is_staff()));

grant select on public.plan_projects, public.plan_media, public.plan_feedback to anon, authenticated;
grant insert on public.plan_feedback to anon, authenticated;
grant insert, update, delete on public.plan_projects, public.plan_media, public.plan_feedback to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('plan-media', 'plan-media', true, 52428800)
on conflict (id) do nothing;

create policy "plan-media staff select" on storage.objects
  for select to authenticated using (bucket_id = 'plan-media' and (select public.is_staff()));
create policy "plan-media staff insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'plan-media' and (select public.is_staff()));
create policy "plan-media staff update" on storage.objects
  for update to authenticated using (bucket_id = 'plan-media' and (select public.is_staff()));
create policy "plan-media staff delete" on storage.objects
  for delete to authenticated using (bucket_id = 'plan-media' and (select public.is_staff()));
