-- 3D models built inside the database (from plan GIS layers + OpenStreetMap), and a stable
-- external id for projects imported from official lists, so a re-import updates instead of duplicating.

create table public.plan_models (
  plan_number text primary key,
  model jsonb not null,
  source text,
  updated_at timestamptz not null default now()
);
alter table public.plan_models enable row level security;
create policy "plan_models public read" on public.plan_models for select to anon, authenticated using (true);
grant select on public.plan_models to anon, authenticated;

alter table public.plan_projects add column if not exists source_id text;
create unique index if not exists plan_projects_source_id_key on public.plan_projects (source_id) where source_id is not null;
