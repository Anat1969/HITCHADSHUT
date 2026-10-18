-- Plan builders that read the Ashdod city GIS (gis.ashdod.muni.il), which the database can reach.
-- The government planning services (mavat, iplan GIS, land.gov.il) are not reachable from here.
-- city_buildings and basic_model replace the Overpass versions in 20261017010000_plan_basic_builders.sql
-- (already applied in the project as plan_builders_city_buildings and plan_builders_basic_model_city_gis).

-- Existing building footprints from the city background map (layer 31, building roofs 2200/2201).
create or replace function plan_builders.city_buildings(p_area geometry)
returns table(g geometry, h numeric)
language plpgsql
set search_path = public, extensions
as $$
declare
  v_env box2d := ST_Extent(ST_Transform(p_area, 2039));
  v_off int := 0;
  v_page jsonb;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '40');
  loop
    select content::jsonb into v_page from extensions.http_get(
      'https://gis.ashdod.muni.il/arcgis/rest/services/mapt_reka/MapServer/31/query?where=' || extensions.urlencode('Layer IN (''2200'',''2201'')')
      || '&geometry=' || extensions.urlencode(format('%s,%s,%s,%s', round(ST_XMin(v_env)), round(ST_YMin(v_env)), round(ST_XMax(v_env)), round(ST_YMax(v_env))))
      || '&geometryType=esriGeometryEnvelope&inSR=2039&outFields=Layer&resultOffset=' || v_off || '&resultRecordCount=2000&f=geojson');
    return query
      select ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(x->'geometry'), 2039), 4326), 13::numeric
      from jsonb_array_elements(v_page->'features') x
      where x->'geometry' is not null and ST_Area(ST_SetSRID(ST_GeomFromGeoJSON(x->'geometry'), 2039)) > 30;
    exit when coalesce(jsonb_array_length(v_page->'features'), 0) < 2000 or v_off > 20000;
    v_off := v_off + 2000;
  end loop;
end $$;

create or replace function plan_builders.basic_model(p_plan_number text, p_radius_m int default 300)
returns jsonb
language plpgsql
set search_path = public, extensions
as $$
declare
  v_blue geometry;
  v_area geometry;
  v_model jsonb;
begin
  select ST_Union(ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326)) into v_blue
  from plan_projects p, jsonb_array_elements(p.geojson->'features') f
  where p.plan_number = p_plan_number and f->'geometry'->>'type' in ('Polygon', 'MultiPolygon');
  if v_blue is null then
    raise exception 'no boundary for plan %', p_plan_number;
  end if;
  v_area := ST_Transform(ST_Buffer(ST_Transform(v_blue, 2039), p_radius_m), 4326);

  with context as (
    select b.g, b.h from plan_builders.city_buildings(v_area) b where ST_Intersects(b.g, v_area)
  )
  select jsonb_build_object(
    'plan_number', p_plan_number,
    'sources', jsonb_build_object(
      'boundary', 'גבול המתחם: שכבת מתחמי ההתחדשות העירונית המוכרזים, data.gov.il',
      'context', 'מבנים קיימים: מפת הרקע של עיריית אשדוד (gis.ashdod.muni.il). הגובה סמלי, 4 קומות'),
    'summary', jsonb_build_object('lots', 0, 'units_after', coalesce(p.units_planned, 0)),
    'ui', jsonb_build_object(
      'summary_label', concat_ws(' · ', p.title,
        case when p.units_planned is not null then to_char(p.units_planned, 'FM9,999') || ' דירות בתוכנית' end),
      'hint', 'המודל מראה את המצב היום. כשיעלו הוראות התוכנית ותשריט מצב מוצע, יופיעו כאן המגרשים, המותר לבנייה והנפח החדש.'),
    'lots', '[]'::jsonb,
    'checks', '[]'::jsonb,
    'massing', jsonb_build_object('type', 'FeatureCollection', 'features', '[]'::jsonb),
    'boundary', jsonb_build_object('type', 'FeatureCollection', 'features', (select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'properties', '{}'::jsonb, 'geometry', ST_AsGeoJSON(ST_ReducePrecision(d.geom, 0.000001))::jsonb))
        from ST_Dump(v_blue) d)),
    'context', jsonb_build_object('type', 'FeatureCollection', 'features', coalesce((select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'properties', jsonb_build_object('h', h),
        'geometry', ST_AsGeoJSON(ST_ReducePrecision(ST_SimplifyPreserveTopology(g, 0.000003), 0.000001))::jsonb)) from context), '[]'::jsonb))
  ) into v_model
  from plan_projects p where p.plan_number = p_plan_number;

  insert into plan_models (plan_number, model, source, updated_at)
  values (p_plan_number, v_model, 'plan_builders.basic_model', now())
  on conflict (plan_number) do update set model = excluded.model, source = excluded.source, updated_at = now();
  return jsonb_build_object('plan', p_plan_number, 'context', jsonb_array_length(v_model->'context'->'features'));
end $$;

-- Registered parcels (layer "חלקות לתצ"א") that intersect an area, in EPSG:4326.
create or replace function plan_builders.city_parcels(p_area geometry)
returns table(gush int, helka int, reg_area numeric, g geometry)
language plpgsql
set search_path = public, extensions
as $$
declare
  v_env box2d := ST_Extent(ST_Transform(p_area, 2039));
  v_page jsonb;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '40');
  select content::jsonb into v_page from extensions.http_get(
    'https://gis.ashdod.muni.il/arcgis/rest/services/' || extensions.urlencode('גושים_וחלקות') || '/MapServer/1/query?outFields=Gush,Helka,Helka_Area&returnGeometry=true&outSR=2039'
    || '&geometry=' || extensions.urlencode(format('%s,%s,%s,%s', round(ST_XMin(v_env)), round(ST_YMin(v_env)), round(ST_XMax(v_env)), round(ST_YMax(v_env))))
    || '&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&inSR=2039&resultRecordCount=2000&f=geojson');
  return query
    select (x->'properties'->>'Gush')::numeric::int, (x->'properties'->>'Helka')::numeric::int, (x->'properties'->>'Helka_Area')::numeric,
           ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(x->'geometry'), 2039), 4326)
    from jsonb_array_elements(v_page->'features') x
    where x->'geometry' is not null;
end $$;

-- Adds the registered parcels inside the compound to its model as lots, for plans that are past approval
-- (permit or construction), where the new lots are usually registered already. No volumes: the page says
-- which parcel is which, its registered area, and that matching it to a plan lot is an estimate.
create or replace function plan_builders.parcels_as_lots(p_plan_number text, p_min_inside numeric default 0.95)
returns jsonb
language plpgsql
set search_path = public, extensions
as $$
declare
  v_blue geometry;
  v_parcels jsonb;
  v_lots jsonb;
  v_n int;
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

  with inside as (
    select c.gush, c.helka, c.reg_area, c.g
    from plan_builders.city_parcels(v_blue) c
    where ST_Area(ST_Intersection(ST_Transform(c.g, 2039), ST_Transform(v_blue, 2039))) / nullif(ST_Area(ST_Transform(c.g, 2039)), 0) >= p_min_inside
  )
  select
    jsonb_build_object('type', 'FeatureCollection', 'features', coalesce(jsonb_agg(jsonb_build_object(
      'type', 'Feature', 'properties', jsonb_build_object('lot', helka, 'gush', gush),
      'geometry', ST_AsGeoJSON(ST_ReducePrecision(g, 0.000001))::jsonb) order by helka), '[]'::jsonb)),
    coalesce(jsonb_agg(jsonb_build_object(
      'lot', helka, 'mixed', false, 'units', 0, 'floors_above', 0, 'height_m', 0,
      'lot_size', round(coalesce(reg_area, ST_Area(ST_Transform(g, 2039)))),
      'center', jsonb_build_array(round(ST_X(ST_PointOnSurface(g))::numeric, 6), round(ST_Y(ST_PointOnSurface(g))::numeric, 6)),
      'title', 'חלקה',
      'panel', jsonb_build_array(
        jsonb_build_object('label', 'גוש', 'value', gush::text),
        jsonb_build_object('label', 'שטח רשום', 'value', to_char(reg_area, 'FM999,999') || ' מ"ר')),
      'note', 'חלקה רשומה מהמפה העירונית. הערכה: זה אחד המגרשים של התוכנית, שנרשם אחרי האישור. את הייעוד והזכויות במגרש קובעות הוראות התוכנית.')
      order by helka), '[]'::jsonb),
    count(*)
  into v_parcels, v_lots, v_n
  from inside;

  update plan_models set
    model = model
      || jsonb_build_object('parcels', v_parcels, 'lots', v_lots)
      || jsonb_build_object('summary', (model->'summary') || jsonb_build_object('lots', v_n))
      || jsonb_build_object('sources', (model->'sources') || jsonb_build_object('parcels', 'חלקות רשומות: שכבת גושים וחלקות של עיריית אשדוד (gis.ashdod.muni.il)'))
      || jsonb_build_object('ui', (model->'ui') || jsonb_build_object(
           'hint', 'המודל מראה את המצב היום ואת החלקות הרשומות בתוך המתחם. לחיצה על חלקה מציגה את הפרטים שלה. הנפח החדש יופיע כשיעלו הוראות התוכנית.')),
    source = 'plan_builders.basic_model + parcels_as_lots',
    updated_at = now()
  where plan_number = p_plan_number;
  return jsonb_build_object('plan', p_plan_number, 'parcels', v_n);
end $$;

revoke all on all functions in schema plan_builders from public, anon, authenticated;
