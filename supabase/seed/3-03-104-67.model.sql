-- 3/03/104/67 (מתחם הרב שאולי): the plan's documents are scanned, so the lots come from the registered parcels
-- (city GIS, gush 2190), grouped by the lot whose drawing area holds each parcel number:
--   lot 1 = parcels 12, 13 and 29 (kindergarten), lot 2 = 16, 17 and 30 (kindergarten), lot 3 = 14 and 15.
-- An estimate: the plan's lots also take in road and open-space land, so the areas differ from table 5.
-- Rights: supabase/seed/3-03-104-67.table5.json, loaded from GitHub raw by commit SHA (replace <sha>).
select extensions.http_set_curlopt('CURLOPT_TIMEOUT', '40');
with b as (
  select ST_Union(ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326)) g
  from plan_projects p, jsonb_array_elements(p.geojson->'features') f where p.plan_number = '3/03/104/67'
), parcels as (
  select c.helka, c.g from b, plan_builders.city_parcels(ST_Transform(ST_Buffer(ST_Transform(b.g, 2039), 40), 4326)) c
  where c.gush = 2190 and c.helka in (12, 13, 14, 15, 16, 17, 29, 30)
), lots as (
  select case when helka in (12, 13, 29) then 1 when helka in (16, 17, 30) then 2 else 3 end lot, ST_Union(g) g
  from parcels group by 1
)
select plan_builders.full_model('3/03/104/67',
  jsonb_build_object('type', 'FeatureCollection', 'features', (select jsonb_agg(jsonb_build_object('type', 'Feature',
    'properties', jsonb_build_object('lot', lot), 'geometry', ST_AsGeoJSON(g)::jsonb)) from lots)),
  (extensions.http_get('https://raw.githubusercontent.com/Anat1969/HITCHADSHUT/<sha>/supabase/seed/3-03-104-67.table5.json')).content::jsonb,
  'מגרשים: חלקות רשומות מהמפה העירונית, מקובצות לפי המגרש בתשריט הסרוק (הערכה)');
