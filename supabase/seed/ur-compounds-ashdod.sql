-- Import / re-sync: every urban renewal compound in Ashdod from the government lists.
--   List and numbers: data.gov.il, "מתחמי התחדשות עירונית" (resource f65a0daf-f737-49c5-9424-d378d52104f5)
--   Blue lines: data.gov.il, GIS layer "מתחמי התחדשות עירונית מוכרזים" (shapefile, ITM),
--   read through the edge function ur-compounds-ashdod (supabase/functions/ur-compounds-ashdod).
-- Runs inside the database with the http extension. Safe to re-run: rows are keyed by source_id 'ur:<compound number>'.
-- A project that already has a plan page (story) keeps its own title, texts and status.

select extensions.http_set_curlopt('CURLOPT_TIMEOUT', '120');

with csv as (
  select content::jsonb j from extensions.http((
    'GET','https://data.gov.il/api/3/action/datastore_search?resource_id=f65a0daf-f737-49c5-9424-d378d52104f5&limit=200&filters='
      || extensions.urlencode('{"SemelYeshuv":70}'),
    array[extensions.http_header('User-Agent','Mozilla/5.0'), extensions.http_header('Accept','application/json')], null, null)::extensions.http_request)
), rec as (
  select trim(x->>'MisparMitham') num, trim(x->>'ShemMitcham') name, nullif(trim(x->>'YachadKayam'),'')::int ex,
         (x->>'YachadMutza')::int prop, nullif(trim(x->>'MisparTochnit'),'') plan, nullif(trim(x->>'KishurLatar'),'') url,
         nullif(trim(x->>'ShnatMatanTokef'),'') yr,
         -- the source pads with non-breaking spaces
         regexp_replace(trim(replace(x->>'Status', chr(160), ' ')), '\s+', ' ', 'g') status
  from csv, jsonb_array_elements(j->'result'->'records') x
), shp as (
  select content::jsonb j from extensions.http_get('https://cbhexpybdggwzyakgagd.supabase.co/functions/v1/ur-compounds-ashdod')
), geo as (
  select f->'properties'->>'MisparProj' num, f->'properties'->>'TeurMaslul' track,
         ST_Transform(ST_SetSRID(ST_MakeValid(ST_GeomFromGeoJSON(f->'geometry')),2039),4326) g
  from shp, jsonb_array_elements(j->'features') f where f->'properties'->>'Yeshuv' = 'אשדוד'
), q as (
  select f.name fq, ST_SetSRID(ST_GeomFromGeoJSON(coalesce(f.geom->'geometry', f.geom)),4326) g
  from mt_map_features f where f.layer = 'quarters_official'
), rows as (
  select 'ur:' || r.num source_id,
    case when r.name like 'התחדשות%' then r.name else 'מתחם ' || r.name end title,
    case when g.track like 'משולב%' then 'other' when r.status = 'תכנון ראשוני' then null else 'pinui_binui' end renewal_track,
    case when r.status like '%אחרי רישוי%' then 'permit'
         when r.status like '%במימוש%' then 'construction'
         when r.status like '%מאושרת%' then 'approved'
         else 'planning' end status,
    r.plan, r.ex, r.prop, r.url, r.yr, r.status raw_status,
    (select qq.id from q join public.quarters qq on replace(qq.name, '''', '') = q.fq where ST_Intersects(q.g, ST_PointOnSurface(g.g)) limit 1) quarter_id,
    jsonb_build_object('type','FeatureCollection','features', jsonb_build_array(jsonb_build_object(
      'type','Feature','properties', jsonb_build_object('name', r.name, 'source', 'ur-gis'),
      'geometry', ST_AsGeoJSON(ST_ReducePrecision(g.g, 0.000001))::jsonb))) geojson,
    jsonb_build_array(round(ST_X(ST_PointOnSurface(g.g))::numeric, 6), round(ST_Y(ST_PointOnSurface(g.g))::numeric, 6)) center
  from rec r join geo g on g.num = r.num
)
insert into public.plan_projects as p
  (source_id, title, kind, renewal_track, status, plan_number, quarter_id, summary, description,
   units_existing, units_planned, geojson, center, published)
select source_id, title, 'urban_renewal', renewal_track, status, plan, quarter_id,
  concat_ws(' ', 'מתחם התחדשות עירונית.',
    case when ex is not null and prop is not null then format('היום %s דירות, ובתוכנית %s.', ex, prop) end),
  concat_ws(E'\n',
    format('הסטטוס לפי הרשות הממשלתית להתחדשות עירונית: %s%s.', raw_status, case when yr is not null then ', שנת מתן תוקף ' || yr else '' end),
    case when plan is not null then 'מספר התוכנית: ' || plan || '.' end,
    case when url is not null then 'מסמכי התוכנית באתר תכנון זמין: ' || url end,
    'הגבול במפה הוא גבול המתחם בשכבה הממשלתית, ויכול להיות שונה מעט מהקו הכחול של התוכנית.'),
  ex, prop, geojson, center, true
from rows
on conflict (source_id) where source_id is not null do update set
  geojson = case when p.story is null then excluded.geojson else p.geojson end,
  center = case when p.story is null then excluded.center else p.center end,
  units_existing = coalesce(p.units_existing, excluded.units_existing),
  units_planned = coalesce(p.units_planned, excluded.units_planned),
  quarter_id = coalesce(p.quarter_id, excluded.quarter_id),
  status = case when p.story is null then excluded.status else p.status end,
  description = case when p.story is null then excluded.description else p.description end,
  summary = case when p.story is null then excluded.summary else p.summary end;
