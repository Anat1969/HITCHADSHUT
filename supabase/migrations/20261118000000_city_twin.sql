-- City model ("מודל העיר"): every published plan in one 3D model, to compare today, approved and planned.
-- Built in the database from plan_models, because loading every plan model in the browser is about 4MB and most
-- of it is the same surrounding buildings repeated by neighbouring plans.
--   stage 'approved' = approved, permit, construction, completed; stage 'planning' = not approved yet.
-- Rebuild after any plan model changes:  select plan_builders.build_city_twin();
-- Published plans without a database model (a static model_url, e.g. 603-0811588) come in with their boundary only.

create table if not exists public.city_twin (
  id int primary key default 1 check (id = 1),
  model jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.city_twin enable row level security;
drop policy if exists "city_twin public read" on public.city_twin;
create policy "city_twin public read" on public.city_twin for select using (true);
grant select on public.city_twin to anon, authenticated;

create or replace function plan_builders.build_city_twin()
returns jsonb
language plpgsql
set search_path = public, extensions
as $$
declare
  v_model jsonb;
begin
  with plans as (
    select p.plan_number, p.title, p.status, p.kind, p.units_existing, p.units_planned, p.center, p.geojson,
           case when p.status = 'planning' then 'planning' else 'approved' end stage, m.model
    from plan_projects p left join plan_models m using (plan_number)
    where p.published
  ), massing_all as (
    select pl.plan_number, pl.stage, f
    from plans pl, jsonb_array_elements(coalesce(pl.model->'massing'->'features', '[]'::jsonb)) f
  ), massing as (
    -- The building volumes (tower, podium); a plan without them shows its envelopes.
    select plan_number, stage, f from massing_all a
    where f->'properties'->>'kind' in ('tower', 'podium')
       or not exists (select 1 from massing_all b where b.plan_number = a.plan_number
                      and b.f->'properties'->>'kind' in ('tower', 'podium'))
  ), demolish as (
    select pl.plan_number, pl.stage, f, ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326) g
    from plans pl, jsonb_array_elements(coalesce(pl.model->'demolish'->'features', '[]'::jsonb)) f
  ), ctx as (
    select distinct on (k) f, g from (
      select f, g, ST_AsText(ST_SnapToGrid(ST_PointOnSurface(g), 0.00001)) k from (
        select f, ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326) g
        from plans pl, jsonb_array_elements(coalesce(pl.model->'context'->'features', '[]'::jsonb)) f
      ) a
    ) b
  ), context as (
    -- Surrounding buildings once, without those a plan demolishes (they are drawn by the demolish layer).
    select f from ctx c
    where not exists (select 1 from demolish d where ST_Intersects(d.g, ST_PointOnSurface(c.g)))
  ), boundaries as (
    select jsonb_build_object('type', 'Feature',
             'properties', jsonb_build_object('plan_number', pl.plan_number, 'title', pl.title, 'status', pl.status,
                                              'stage', pl.stage, 'units_planned', pl.units_planned),
             'geometry', b->'geometry') f
    from plans pl, jsonb_array_elements(coalesce(pl.model->'boundary', pl.geojson)->'features') b
    where b->'geometry'->>'type' in ('Polygon', 'MultiPolygon')
  ), heights as (
    select plan_number, max((f->'properties'->>'top')::numeric) h from massing_all group by 1
  )
  select jsonb_build_object(
    'built_at', now(),
    'boundaries', jsonb_build_object('type', 'FeatureCollection', 'features', coalesce((select jsonb_agg(f) from boundaries), '[]')),
    'massing', jsonb_build_object('type', 'FeatureCollection', 'features', coalesce((select jsonb_agg(jsonb_set(jsonb_set(f,
        '{properties,plan_number}', to_jsonb(plan_number)), '{properties,stage}', to_jsonb(stage))) from massing), '[]')),
    'demolish', jsonb_build_object('type', 'FeatureCollection', 'features', coalesce((select jsonb_agg(jsonb_set(jsonb_set(f,
        '{properties,plan_number}', to_jsonb(plan_number)), '{properties,stage}', to_jsonb(stage))) from demolish), '[]')),
    'context', jsonb_build_object('type', 'FeatureCollection', 'features', coalesce((select jsonb_agg(f) from context), '[]')),
    'plans', coalesce((select jsonb_agg(jsonb_build_object(
        'plan_number', pl.plan_number, 'title', pl.title, 'status', pl.status, 'stage', pl.stage, 'kind', pl.kind,
        'units_existing', pl.units_existing, 'units_planned', pl.units_planned, 'center', pl.center,
        'height_max', h.h) order by pl.stage, pl.title)
      from plans pl left join heights h using (plan_number)), '[]')
  ) into v_model;

  insert into city_twin (id, model, updated_at) values (1, v_model, now())
  on conflict (id) do update set model = excluded.model, updated_at = now();
  return jsonb_build_object(
    'plans', jsonb_array_length(v_model->'plans'),
    'massing', jsonb_array_length(v_model->'massing'->'features'),
    'demolish', jsonb_array_length(v_model->'demolish'->'features'),
    'context', jsonb_array_length(v_model->'context'->'features'),
    'kb', length(v_model::text) / 1024);
end $$;

revoke all on function plan_builders.build_city_twin() from public, anon, authenticated;
