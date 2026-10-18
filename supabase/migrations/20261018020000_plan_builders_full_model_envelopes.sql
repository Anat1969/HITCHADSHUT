-- Full model with building lines: the volumes sit inside the building lines traced from the drawing,
-- with floors, height and built area from table 5. Replaces the 4-argument full_model.
drop function if exists plan_builders.full_model(text, jsonb, jsonb, text);

-- p_lots: GeoJSON FeatureCollection (EPSG:4326), each feature with properties.lot.
-- p_t5:   {"total_units": n, "lots": [{"lot", "use", "lot_size", "units", "floors_above", "floors_below", "height_m",
--          "coverage_pct", "main_above", "service_above", "service_below", "commercial_main", "podium_floors", "ref"}]}
-- p_envelopes: optional FeatureCollection (EPSG:4326) of building-line polygons traced from the drawing,
--   properties.lot and properties.kind = 'envelope' (קו בניין) or 'tower' (קו בניין לבניין גבוה / למגדל).
-- Massing per lot:
--   envelope = the building lines (or the whole lot when none were traced), up to the maximum height in table 5;
--   building = inside the envelope, typical floor area = above-ground area / floors, capped by the coverage;
--   with a tower line: a tower inside it up to the full height, on a podium of podium_floors (when given).
create or replace function plan_builders.full_model(p_plan_number text, p_lots jsonb, p_t5 jsonb, p_source text default null,
                                                    p_envelopes jsonb default null)
returns jsonb
language plpgsql
set search_path = public, extensions
as $$
declare
  v_blue geometry;
  v_model jsonb;
  v_res jsonb;
begin
  select ST_Union(ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326)) into v_blue
  from plan_projects p, jsonb_array_elements(p.geojson->'features') f
  where p.plan_number = p_plan_number and f->'geometry'->>'type' in ('Polygon', 'MultiPolygon');
  if v_blue is null then
    raise exception 'no boundary for plan %', p_plan_number;
  end if;
  if not exists (select 1 from plan_models where plan_number = p_plan_number) then
    perform plan_builders.basic_model(p_plan_number);
  end if;
  select model into v_model from plan_models where plan_number = p_plan_number;

  with geo as (
    select (f->'properties'->>'lot')::int lot,
           ST_Union(ST_Transform(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326)), 2039)) g
    from jsonb_array_elements(p_lots->'features') f
    where f->'properties'->>'lot' ~ '^\d+$'
    group by 1
  ), t5 as (
    select (r->>'lot')::int lot, r->>'use' use, (r->>'lot_size')::numeric lot_size, coalesce((r->>'units')::int, 0) units,
           (r->>'floors_above')::int floors_above, (r->>'floors_below')::int floors_below, (r->>'height_m')::numeric height_m,
           (r->>'coverage_pct')::numeric coverage_pct, (r->>'main_above')::numeric main_above,
           (r->>'service_above')::numeric service_above, (r->>'service_below')::numeric service_below,
           (r->>'commercial_main')::numeric commercial_main, (r->>'podium_floors')::int podium_floors, r->>'ref' ref
    from jsonb_array_elements(p_t5->'lots') r
    where r->>'lot' ~ '^\d+$'
  ), lines as (
    select (f->'properties'->>'lot')::int lot, coalesce(f->'properties'->>'kind', 'envelope') kind,
           ST_Union(ST_Transform(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326)), 2039)) g
    from jsonb_array_elements(coalesce(p_envelopes->'features', '[]'::jsonb)) f
    where f->'properties'->>'lot' ~ '^\d+$'
    group by 1, 2
  ), lots0 as (
    select t5.*, geo.g, ST_Area(geo.g) geo_area,
           coalesce(t5.height_m, t5.floors_above * 3.3) top,
           coalesce(ST_Intersection(e.g, geo.g), geo.g) env,
           e.g is not null has_lines,
           ST_Intersection(tl.g, geo.g) tline
    from t5 join geo using (lot)
    left join lines e on e.lot = t5.lot and e.kind = 'envelope'
    left join lines tl on tl.lot = t5.lot and tl.kind = 'tower'
  ), lots as (
    select l.*, ST_Area(env) env_area,
           -- typical floor: built area above ground spread over the floors, never over the coverage or the envelope
           least(
             coalesce((coalesce(main_above, 0) + coalesce(service_above, 0)) / nullif(floors_above, 0), geo_area * coalesce(coverage_pct, 60) / 100),
             geo_area * coalesce(coverage_pct, 100) / 100,
             ST_Area(coalesce(tline, env)) * 0.98)::numeric plate
    from lots0 l
  ), massing as (
    select jsonb_build_object('type', 'Feature',
             'properties', jsonb_build_object('lot', lot, 'kind', 'envelope', 'base', 0, 'top', top),
             'geometry', ST_AsGeoJSON(ST_ReducePrecision(ST_Transform(env, 4326), 0.000001))::jsonb) f
    from lots where top > 0
    union all
    select jsonb_build_object('type', 'Feature',
             'properties', jsonb_build_object('lot', lot, 'kind', 'tower', 'base', 0, 'top', top),
             'geometry', ST_AsGeoJSON(ST_ReducePrecision(ST_Transform(
               plan_builders.inset_to_area(coalesce(tline, env), plate), 4326), 0.000001))::jsonb)
    from lots where top > 0 and plate > 0
    union all
    select jsonb_build_object('type', 'Feature',
             'properties', jsonb_build_object('lot', lot, 'kind', 'podium', 'base', 0, 'top', podium_floors * 4.5),
             'geometry', ST_AsGeoJSON(ST_ReducePrecision(ST_Transform(
               plan_builders.inset_to_area(env, (geo_area * coalesce(coverage_pct, 100) / 100)::numeric), 4326), 0.000001))::jsonb)
    from lots where tline is not null and podium_floors > 0
  ), demolish as (
    select b.g, b.h from plan_builders.city_buildings(v_blue) b
    where ST_Within(ST_PointOnSurface(b.g), v_blue)
  ), checks as (
    select jsonb_build_object('lot', 0, 'level', 'warn', 'text',
             format('סך הדירות בטבלה 5 (%s) שונה מסך הדירות בתוכנית (%s).', s.u, p.units_planned)) c
    from (select coalesce((p_t5->>'total_units')::int, sum(units)) u from t5) s, plan_projects p
    where p.plan_number = p_plan_number and p.units_planned is not null and s.u <> p.units_planned
    union all
    select jsonb_build_object('lot', lot, 'level', 'warn', 'text',
             format('שטח המגרש בתשריט (%s מ"ר) שונה ביותר מ-5%% מהשטח בטבלה 5 (%s מ"ר).', round(geo_area), round(lot_size)))
    from lots where lot_size > 0 and abs(geo_area - lot_size) / lot_size > 0.05
    union all
    select jsonb_build_object('lot', t5.lot, 'level', 'info', 'text', 'המגרש מופיע בטבלה 5 ולא זוהה בתשריט.')
    from t5 left join geo using (lot) where geo.lot is null
  )
  select jsonb_build_object(
    'lots', coalesce((select jsonb_agg(jsonb_build_object(
        'lot', lot, 'mixed', coalesce(commercial_main, 0) > 0, 'units', units,
        'floors_above', coalesce(floors_above, 0), 'floors_below', floors_below, 'height_m', coalesce(height_m, 0),
        'lot_size', round(coalesce(lot_size, geo_area)), 'coverage_pct', coverage_pct,
        'main_above', main_above, 'service_above', service_above, 'service_below', service_below, 'commercial_main', commercial_main,
        'floor_plate_m2', round(plate), 'envelope_m2', round(env_area),
        'center', jsonb_build_array(round(ST_X(ST_Transform(ST_PointOnSurface(g), 4326))::numeric, 6), round(ST_Y(ST_Transform(ST_PointOnSurface(g), 4326))::numeric, 6)),
        'title', coalesce(use, 'מגרש'),
        'panel', (select jsonb_agg(x) from (
            select jsonb_build_object('label', 'דירות', 'value', units::text) x where units > 0
            union all select jsonb_build_object('label', 'קומות', 'value', floors_above::text) where floors_above is not null
            union all select jsonb_build_object('label', 'גובה מרבי', 'value', height_m::text || ' מ׳') where height_m is not null
            union all select jsonb_build_object('label', 'שטח המגרש', 'value', to_char(coalesce(lot_size, geo_area), 'FM999,999') || ' מ"ר')
            union all select jsonb_build_object('label', 'שטח עיקרי', 'value', to_char(main_above, 'FM999,999') || ' מ"ר') where main_above is not null
            union all select jsonb_build_object('label', 'תכסית', 'value', coverage_pct::text || '%') where coverage_pct is not null
            union all select jsonb_build_object('label', 'קומה טיפוסית', 'value', 'כ-' || to_char(plate, 'FM999,999') || ' מ"ר (הערכה)') where plate > 0 and top > 0
            union all select jsonb_build_object('label', 'מסחר', 'value', to_char(commercial_main, 'FM999,999') || ' מ"ר') where commercial_main > 0
          ) s),
        'note', concat_ws(' ', 'לפי התוכנית: ' || coalesce(ref, 'טבלה 5') || '.',
                 case when has_lines then 'המעטפת בתלת-ממד לפי קווי הבניין בתשריט ועד הגובה המרבי.' else 'המעטפת בתלת-ממד היא כל המגרש, כי קווי הבניין לא זוהו בתשריט.' end,
                 'הבניין בתוכה הוא הערכה: שטח הקומה הוא השטח מעל הקרקע חלקי מספר הקומות.'))
        order by lot) from lots), '[]'::jsonb),
    'massing', jsonb_build_object('type', 'FeatureCollection', 'features', coalesce((select jsonb_agg(f) from massing), '[]'::jsonb)),
    'parcels', jsonb_build_object('type', 'FeatureCollection', 'features', coalesce((select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'properties', jsonb_build_object('lot', lot),
        'geometry', ST_AsGeoJSON(ST_ReducePrecision(ST_Transform(g, 4326), 0.000001))::jsonb)) from geo), '[]'::jsonb)),
    'demolish', jsonb_build_object('type', 'FeatureCollection', 'features', coalesce((select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'properties', jsonb_build_object('h', h),
        'geometry', ST_AsGeoJSON(ST_ReducePrecision(g, 0.000001))::jsonb)) from demolish), '[]'::jsonb)),
    'checks', coalesce((select jsonb_agg(c) from checks), '[]'::jsonb),
    'summary', (v_model->'summary') || jsonb_build_object(
        'lots', (select count(*) from lots),
        'units_after', coalesce((p_t5->>'total_units')::int, (select coalesce(sum(units), 0) from t5)),
        'floors_max', (select max(floors_above) from t5),
        'height_max', (select max(height_m) from t5)),
    'sources', (v_model->'sources') || jsonb_build_object(
        'lots', coalesce(p_source, 'מגרשים וקווי בניין: תשריט מצב מוצע של התוכנית, מעוגן לרשת ITM'),
        'rights', 'זכויות: הוראות התוכנית, טבלה 5'),
    'ui', (v_model->'ui') || jsonb_build_object(
        'hint', 'המגרשים וקווי הבניין מהתשריט, הקומות והגובה מטבלה 5. הבניין עצמו הוא הערכה. לחיצה על מגרש מציגה את הזכויות שלו.',
        'modes', jsonb_build_object(
          'allowed', 'המעטפת השקופה היא השטח שבין קווי הבניין, עד הגובה המרבי בטבלה 5.',
          'after', 'נפח לדוגמה: שטח הקומה הוא השטח מעל הקרקע בטבלה 5 חלקי מספר הקומות, בתוך קווי הבניין. הערכה, לא תכנון הבינוי.'))
  ) into v_res;

  update plan_models set model = v_model || v_res, source = 'plan_builders.full_model', updated_at = now()
  where plan_number = p_plan_number;
  return jsonb_build_object('plan', p_plan_number, 'lots', jsonb_array_length(v_res->'lots'),
    'massing', jsonb_array_length(v_res->'massing'->'features'), 'checks', v_res->'checks');
end $$;

revoke all on all functions in schema plan_builders from public, anon, authenticated;
