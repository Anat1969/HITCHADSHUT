-- 3/03/102/94 (מתחם הדקל, רובע א'): the plan's documents are scanned, and the drawing (תשריט, 24 MB) could not be
-- downloaded from Drive, so the lots come from the registered parcels (city GIS, gush 2088), one parcel per lot.
-- Order: section 6.1.1 builds lot by lot "בסדר עולה ממערב למזרח", so lot 1 = the westernmost parcel:
--   lot 1 = parcel 146, lot 2 = 147, lot 3 = 148, lot 4 = 149, lot 5 = 150.
-- The small parcels 158, 159 and 160 (66-123 m², between the big ones) are left out.
-- An estimate: the plan re-parcels the land (איחוד וחלוקה), so the lot shapes and sizes differ from table 5.
--   Sum of parcels 146-150: 12,384 m²; residential land in table 3.2 and table 5: 12,372 m².
--   Per lot (parcel / table 5): 2,450/2,510, 2,452/2,557, 2,502/2,498, 2,396/2,512, 2,584/2,295.
-- The open-space lots (101-104) and the roads are not drawn: their shapes are only in the drawing.
-- No building lines: table 5 says "לפי המסומן בתשריט", without metres.
-- Rights: supabase/seed/3-03-102-94.table5.json, loaded from GitHub raw by commit SHA (replace <sha>).
select extensions.http_set_curlopt('CURLOPT_TIMEOUT', '40');
with b as (
  select ST_Union(ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326)) g
  from plan_projects p, jsonb_array_elements(p.geojson->'features') f where p.plan_number = '3/03/102/94'
), parcels as (
  select c.helka, c.g from b, plan_builders.city_parcels(ST_Transform(ST_Buffer(ST_Transform(b.g, 2039), 40), 4326)) c
  where c.gush = 2088 and c.helka in (146, 147, 148, 149, 150)
), lots as (
  select helka - 145 lot, ST_Union(g) g from parcels group by 1
)
select plan_builders.full_model('3/03/102/94',
  jsonb_build_object('type', 'FeatureCollection', 'features', (select jsonb_agg(jsonb_build_object('type', 'Feature',
    'properties', jsonb_build_object('lot', lot), 'geometry', ST_AsGeoJSON(g)::jsonb)) from lots)),
  (extensions.http_get('https://raw.githubusercontent.com/Anat1969/HITCHADSHUT/<sha>/supabase/seed/3-03-102-94.table5.json')).content::jsonb,
  'מגרשים: חלקות רשומות מהמפה העירונית, חלקה אחת לכל מגרש לפי סדר הבנייה ממערב למזרח (הערכה)');
