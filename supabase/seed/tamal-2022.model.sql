-- Build the 3D model of plan תמל/2022 (פינוי-בינוי, ציר הרצל - רח' המעפילים) into public.plan_models.
-- Runs inside the database (PostGIS + http extension). Safe to re-run.
--
-- Sources
--   blue line      : plan KML from תכנון זמין, already on the project (plan_projects.geojson)
--   lots, envelope : mavat SHP layers stored by the planning dashboard (mt_plans.lots, mt_plan_layers:
--                    land_use, demolish, proposed). These were converted from ITM without the datum shift,
--                    so they sit about 76 m south-west of their true place. They are moved by (+65.4, +40.2) m
--                    in ITM, the translation that best fits their blue line onto the KML blue line
--                    (symmetric difference 384 m2 on 145 dunam).
--   context        : OpenStreetMap buildings (ODbL) within 350 m, via the Overpass API.
--                    Height = building:levels x 3.1 m when tagged, otherwise 13 m (4 floors) or 7 m for small houses.

select extensions.http_set_curlopt('CURLOPT_TIMEOUT', '120');

with
plan as (select id, lots from mt_plans where plan_number = 'תמל/2022'),
lay as (
  select l.kind, f->'properties' props,
         ST_Transform(ST_Translate(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326), 2039), 65.4, 40.2), 4326) g
  from mt_plan_layers l join plan on plan.id = l.plan_id, jsonb_array_elements(l.geojson->'features') f
  union all
  select 'lot', f->'properties',
         ST_Transform(ST_Translate(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326), 2039), 65.4, 40.2), 4326)
  from plan, jsonb_array_elements(plan.lots->'features') f
),
blue as (
  select ST_Union(ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326)) g
  from plan_projects p, jsonb_array_elements(p.geojson->'features') f where p.plan_number = 'תמל/2022'
),
osm_raw as (
  select content::jsonb j from extensions.http((
    'POST', 'https://overpass-api.de/api/interpreter', array[extensions.http_header('User-Agent', 'ashdod-ma-nivne/1.0')],
    'application/x-www-form-urlencoded',
    'data=' || extensions.urlencode('[out:json][timeout:60];way["building"](31.799,34.643,31.812,34.664);out tags geom;'))::extensions.http_request)
),
osm as (
  select e->'tags' tags,
         ST_SetSRID(ST_MakePolygon(ST_MakeLine(array(
           select ST_MakePoint((p->>'lon')::float8, (p->>'lat')::float8) from jsonb_array_elements(e->'geometry') p))), 4326) g
  from osm_raw, jsonb_array_elements(j->'elements') e
  where jsonb_array_length(e->'geometry') >= 4 and e->'geometry'->0 = e->'geometry'->-1
),
demolish as (select g from lay where kind = 'demolish'),
context as (
  select o.g,
    case when o.tags ? 'building:levels' and (o.tags->>'building:levels') ~ '^\d+$' then (o.tags->>'building:levels')::int * 3.1
         when ST_Area(o.g::geography) < 120 then 7 else 13 end h
  from osm o, blue
  where ST_DWithin(o.g::geography, blue.g::geography, 350)
    and not exists (select 1 from demolish d where ST_Intersects(d.g, o.g)
                    and ST_Area(ST_Intersection(d.g, o.g)) > 0.3 * ST_Area(o.g))
),
towers(lot, n) as (values (101, 1), (102, 3), (103, 1), (104, 1), (105, 1), (106, 1), (107, 1)),
lots as (
  select (props->>'lot')::int lot, props->>'yeud' yeud, props->'rights' rights, g from lay where kind = 'lot'
),
env as (select (props->>'lot')::int lot, (props->>'top')::numeric top from lay where kind = 'proposed' and props->>'kind' = 'envelope'),
lotdata as (
  select l.lot, l.yeud, l.g, e.top,
    (select (r->>'units')::int from jsonb_array_elements(l.rights) r where r->>'units' is not null limit 1) units,
    (select (r->>'floors')::int from jsonb_array_elements(l.rights) r where r->>'floors' is not null limit 1) floors,
    (select (r->>'lotArea')::numeric from jsonb_array_elements(l.rights) r where r->>'lotArea' is not null limit 1) lot_size,
    (select sum((r->>'builtM2')::numeric) from jsonb_array_elements(l.rights) r where r->>'use' in ('מגורים', '')) main_m2,
    (select sum((r->>'builtM2')::numeric) from jsonb_array_elements(l.rights) r where r->>'use' in ('מסחר', 'תעסוקה', 'מסחר ותעסוקה')) com_m2,
    (select sum((r->>'builtM2')::numeric) from jsonb_array_elements(l.rights) r where r->>'use' = 'מבנים ומוסדות ציבור') pub_m2,
    t.n towers
  from lots l join env e on e.lot = l.lot left join towers t on t.lot = l.lot
),
model as (
  select jsonb_build_object(
    'plan_number', 'תמל/2022',
    'sources', jsonb_build_object(
      'boundary', 'קובץ KML של גבול התוכנית מאתר תכנון זמין',
      'lots', 'שכבות SHP של התוכנית ממבא"ת: ייעודי קרקע, מבנים להריסה ומעטפת מקווי הבניין',
      'table5', 'טבלה 5, הוראות התכנית עמ׳ 19–22',
      'context', 'מבנים קיימים מ-OpenStreetMap (ODbL). הגובה משוער לפי מספר הקומות'),
    'summary', jsonb_build_object(
      'lots', 7, 'units_after', 2160, 'units_before_est', 487, 'units_added_est', 1673,
      'small_75_min', 216, 'micro_55_min', 432, 'floors_min', 31, 'floors_max', 32, 'height_max', 120.5,
      'area_dunam', 144.52, 'service_below_m2', 0, 'commercial_lots', jsonb_build_array(101, 102, 103, 104, 105, 106, 107),
      'avg_unit_before_est', 0, 'avg_unit_after', 0),
    'ui', jsonb_build_object(
      'modes', jsonb_build_object(
        'today', 'היום: 18 בנייני השיכון שמיועדים להריסה מודגשים בכהה, וסביבם הבניינים הקיימים. גבול התוכנית בקו מקווקו.',
        'allowed', 'המעטפת השקופה היא השטח והגובה שמותר לבנות בכל מגרש: קווי הבניין מהתשריט והגובה המרבי מטבלה 5.',
        'after', 'נפח בנייה לדוגמה: קומות מסחר, תעסוקה וציבור לאורך שדרות הרצל, ומעליהן מגדל מגורים. הנפח מחושב משטחי הבנייה בטבלה 5. הוא המחשה, לא נספח הבינוי.'),
      'summary_label', '7 מגרשי מגורים · 2,160 דירות',
      'hint', 'לחצו על מגדל כדי לראות מה מותר לבנות במגרש: דירות, מגדלים, קומות, מסחר ושטחי ציבור.',
      'demolish_label', 'להריסה'),
    'lots', (select jsonb_agg(jsonb_build_object(
        'lot', lot,
        'mixed', com_m2 is not null,
        'units', coalesce(units, 0),
        'floors_above', floors,
        'height_m', top,
        'lot_size', lot_size,
        'center', jsonb_build_array(round(ST_X(ST_PointOnSurface(g))::numeric, 6), round(ST_Y(ST_PointOnSurface(g))::numeric, 6)),
        'title', case when lot < 200 then 'מגרש ' || lot else 'מגרש ' || lot || ' · מבנים ומוסדות ציבור' end,
        'panel', (select jsonb_agg(x) from (
           select jsonb_build_object('label', case when lot < 200 then 'דירות' else 'דיור מיוחד' end, 'value', to_char(units, 'FM9,999')) x where units is not null
           union all select jsonb_build_object('label', 'מגדלים', 'value', towers::text) where towers is not null
           union all select jsonb_build_object('label', 'קומות', 'value', 'עד ' || floors) where floors is not null
           union all select jsonb_build_object('label', 'גובה מרבי', 'value', trim(to_char(top, 'FM999.9')) || ' מ׳')
           union all select jsonb_build_object('label', 'שטח המגרש', 'value', to_char(lot_size, 'FM99,999') || ' מ"ר') where lot_size is not null
           union all select jsonb_build_object('label', case when lot < 200 then 'שטח למגורים' else 'שטח בנייה' end, 'value', to_char(main_m2, 'FM999,999') || ' מ"ר') where main_m2 is not null
           union all select jsonb_build_object('label', 'מסחר ותעסוקה', 'value', to_char(com_m2, 'FM999,999') || ' מ"ר') where com_m2 is not null
           union all select jsonb_build_object('label', 'שטחי ציבור בבניין', 'value', to_char(pub_m2, 'FM999,999') || ' מ"ר') where pub_m2 is not null
        ) s),
        'note', case when lot < 200
          then 'בכל המגרשים יחד: לפחות 20% מהדירות קטנות מאוד (30 עד 55 מ"ר) ולפחות 10% קטנות (56 עד 80 מ"ר). בקומות התחתונות מסחר ותעסוקה, עם חזית פעילה לרחוב.'
          else 'מגרש ציבורי שבו מותר גם דיור מיוחד: מעונות סטודנטים, דיור מוגן, דיור ציבורי לקשישים או דיור בהישג יד להשכרה (סעיף 4.2.1).' end
      ) order by lot) from lotdata),
    'checks', '[]'::jsonb,
    'massing', jsonb_build_object('type', 'FeatureCollection', 'features', (select jsonb_agg(jsonb_build_object(
        'type', 'Feature',
        'properties', jsonb_build_object('lot', (props->>'lot')::int, 'kind', props->>'kind',
                                         'base', coalesce((props->>'base')::numeric, 0),
                                         'top', coalesce((props->>'top')::numeric, (props->>'height')::numeric),
                                         'floors', (props->>'floors')::int, 'units', (props->>'units')::int),
        'geometry', ST_AsGeoJSON(ST_ReducePrecision(g, 0.0000001))::jsonb)) from lay where kind = 'proposed')),
    'boundary', jsonb_build_object('type', 'FeatureCollection', 'features', (select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'properties', '{}'::jsonb, 'geometry', ST_AsGeoJSON(d.geom)::jsonb)) from blue, ST_Dump(blue.g) d)),
    'demolish', jsonb_build_object('type', 'FeatureCollection', 'features', (select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'properties', jsonb_build_object('h', 13),
        'geometry', ST_AsGeoJSON(ST_ReducePrecision(g, 0.000001))::jsonb)) from demolish where ST_Area(g::geography) > 20)),
    'parcels', jsonb_build_object('type', 'FeatureCollection', 'features', (select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'properties', jsonb_build_object('lot', props->>'lot', 'yeud', props->>'yeud'),
        'geometry', ST_AsGeoJSON(ST_ReducePrecision(g, 0.000001))::jsonb)) from lay where kind = 'lot')),
    'context', jsonb_build_object('type', 'FeatureCollection', 'features', (select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'properties', jsonb_build_object('h', h),
        'geometry', ST_AsGeoJSON(ST_ReducePrecision(g, 0.000001))::jsonb)) from context))
  ) m
)
insert into public.plan_models (plan_number, model, source, updated_at)
select 'תמל/2022', m, 'supabase/seed/tamal-2022.model.sql', now() from model
on conflict (plan_number) do update set model = excluded.model, source = excluded.source, updated_at = now();
