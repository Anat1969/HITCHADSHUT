-- Builders for plan pages of urban renewal compounds that have no plan documents yet.
-- Private schema: callable only by the database owner (service / SQL editor), never through the public API,
-- because the model builder makes outbound HTTP requests (Overpass API).

create schema if not exists plan_builders;
revoke all on schema plan_builders from public, anon, authenticated;

-- 3D model with today's state only: the compound boundary and the existing buildings around it
-- (OpenStreetMap, ODbL). Height = building:levels x 3.1 m when tagged, otherwise 13 m, or 7 m for small buildings.
create or replace function plan_builders.basic_model(p_plan_number text, p_radius_m int default 300)
returns jsonb
language plpgsql
set search_path = public, extensions
as $$
declare
  v_blue geometry;
  v_bbox box2d;
  v_osm jsonb;
  v_model jsonb;
begin
  select ST_Union(ST_SetSRID(ST_GeomFromGeoJSON(f->'geometry'), 4326)) into v_blue
  from plan_projects p, jsonb_array_elements(p.geojson->'features') f
  where p.plan_number = p_plan_number and f->'geometry'->>'type' in ('Polygon', 'MultiPolygon');
  if v_blue is null then
    raise exception 'no boundary for plan %', p_plan_number;
  end if;

  v_bbox := ST_Extent(ST_Transform(ST_Buffer(ST_Transform(v_blue, 2039), p_radius_m), 4326));
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '90');
  select content::jsonb into v_osm from extensions.http((
    'POST', 'https://overpass-api.de/api/interpreter', array[extensions.http_header('User-Agent', 'ashdod-ma-nivne/1.0')],
    'application/x-www-form-urlencoded',
    'data=' || extensions.urlencode(format('[out:json][timeout:60];way["building"](%s,%s,%s,%s);out tags geom;',
      ST_YMin(v_bbox), ST_XMin(v_bbox), ST_YMax(v_bbox), ST_XMax(v_bbox))))::extensions.http_request);

  with osm as (
    select e->'tags' tags,
           ST_SetSRID(ST_MakePolygon(ST_MakeLine(array(
             select ST_MakePoint((pt->>'lon')::float8, (pt->>'lat')::float8) from jsonb_array_elements(e->'geometry') pt))), 4326) g
    from jsonb_array_elements(v_osm->'elements') e
    where jsonb_array_length(e->'geometry') >= 4 and e->'geometry'->0 = e->'geometry'->-1
  ), context as (
    select g,
      case when tags ? 'building:levels' and (tags->>'building:levels') ~ '^\d+$' then (tags->>'building:levels')::int * 3.1
           when ST_Area(g::geography) < 120 then 7 else 13 end h
    from osm
    where ST_DWithin(g::geography, v_blue::geography, p_radius_m)
  )
  select jsonb_build_object(
    'plan_number', p_plan_number,
    'sources', jsonb_build_object(
      'boundary', 'גבול המתחם: שכבת מתחמי ההתחדשות העירונית המוכרזים, data.gov.il',
      'context', 'מבנים קיימים מ-OpenStreetMap (ODbL). הגובה משוער לפי מספר הקומות'),
    'summary', jsonb_build_object('lots', 0, 'units_after', coalesce(p.units_planned, 0)),
    'ui', jsonb_build_object(
      'summary_label', concat_ws(' · ', p.title,
        case when p.units_planned is not null then to_char(p.units_planned, 'FM9,999') || ' דירות בתוכנית' end),
      'hint', 'המודל מראה את המצב היום. כשיעלו טבלה 5 וקובץ KML של התוכנית, יופיעו כאן המגרשים, המותר לבנייה והנפח החדש.'),
    'lots', '[]'::jsonb,
    'checks', '[]'::jsonb,
    'massing', jsonb_build_object('type', 'FeatureCollection', 'features', '[]'::jsonb),
    'boundary', jsonb_build_object('type', 'FeatureCollection', 'features', (select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'properties', '{}'::jsonb, 'geometry', ST_AsGeoJSON(ST_ReducePrecision(d.geom, 0.000001))::jsonb))
        from ST_Dump(v_blue) d)),
    'context', jsonb_build_object('type', 'FeatureCollection', 'features', coalesce((select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'properties', jsonb_build_object('h', h),
        'geometry', ST_AsGeoJSON(ST_ReducePrecision(g, 0.000001))::jsonb)) from context), '[]'::jsonb))
  ) into v_model
  from plan_projects p where p.plan_number = p_plan_number;

  insert into plan_models (plan_number, model, source, updated_at)
  values (p_plan_number, v_model, 'plan_builders.basic_model', now())
  on conflict (plan_number) do update set model = excluded.model, source = excluded.source, updated_at = now();
  return jsonb_build_object('plan', p_plan_number, 'context', jsonb_array_length(v_model->'context'->'features'));
end $$;

-- A short plan story from the national open data (no plan documents). Marked level = 'basic'.
create or replace function plan_builders.basic_story(p_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'plan_number', p.plan_number,
    'official_name', p.title,
    'mavat_url', coalesce(substring(p.description from 'https://mavat\S+'), 'https://mavat.iplan.gov.il'),
    'kicker', concat_ws(' · ', q.name, 'התחדשות עירונית'),
    'headline', p.title,
    'deck', case
      when p.units_existing is not null and p.units_planned is not null then
        format('%s דירות היום, ו-%s דירות בתוכנית. פי %s.', to_char(p.units_existing, 'FM9,999'), to_char(p.units_planned, 'FM9,999'),
               trim(to_char(round(p.units_planned::numeric / nullif(p.units_existing, 0), 1), 'FM99.0')))
      else 'מתחם התחדשות עירונית.' end,
    'status', jsonb_build_object(
      'label', case p.status when 'planning' then 'בתכנון' when 'approved' then 'תוכנית מאושרת' when 'permit' then 'היתר בנייה'
                             when 'construction' then 'בביצוע' else 'הושלם' end,
      'text', coalesce(split_part(p.description, E'\n', 1), ''),
      'source', 'מאגר מתחמי ההתחדשות העירונית, data.gov.il'),
    'chapters', jsonb_build_array(
      jsonb_build_object('id', 'headline', 'title', 'במשפט אחד',
        'lead', case when p.units_existing is not null and p.units_planned is not null
          then format('פינוי-בינוי: %s דירות ישנות מתחלפות ב-%s דירות חדשות.', to_char(p.units_existing, 'FM9,999'), to_char(p.units_planned, 'FM9,999'))
          else 'מתחם התחדשות עירונית שהממשלה הכריזה עליו.' end,
        'paragraphs', jsonb_build_array(
          'זה עמוד בסיסי, שנבנה מהנתונים הפתוחים של הרשות הממשלתית להתחדשות עירונית. כשיעלו מסמכי התוכנית, הוא יתמלא בפרטים: מה ייבנה, מה השכונה מקבלת, ומה משתנה לתושבים.'),
        'sources', jsonb_build_array('מאגר מתחמי ההתחדשות העירונית, data.gov.il')),
      jsonb_build_object('id', 'numbers', 'title', 'במספרים', 'lead', 'לפי הרשות הממשלתית להתחדשות עירונית.',
        'facts', (select jsonb_agg(x) from (
          select jsonb_build_object('value', to_char(p.units_existing, 'FM9,999'), 'unit', 'דירות', 'label', 'היום במתחם', 'certainty', 'plan') x where p.units_existing is not null
          union all select jsonb_build_object('value', to_char(p.units_planned, 'FM9,999'), 'unit', 'דירות', 'label', 'בתוכנית', 'certainty', 'plan') where p.units_planned is not null
          union all select jsonb_build_object('value', to_char(p.units_planned - p.units_existing, 'FM9,999'), 'unit', 'דירות', 'label', 'תוספת', 'certainty', 'plan')
            where p.units_planned is not null and p.units_existing is not null) s),
        'sources', jsonb_build_array('data.gov.il')),
      jsonb_build_object('id', 'path', 'title', 'איפה זה עומד', 'lead', 'השלבים של פינוי-בינוי.',
        'steps', jsonb_build_array(
          jsonb_build_object('title', 'תכנון', 'text', 'התוכנית נבחנת בוועדות. זה השלב שבו הערות התושבים משפיעות הכי הרבה.'),
          jsonb_build_object('title', 'אישור התוכנית', 'text', 'התוכנית מתפרסמת למתן תוקף.'),
          jsonb_build_object('title', 'היתר בנייה', 'text', 'תוכנית בינוי מפורטת, הסכמי דיירים והיתרים.'),
          jsonb_build_object('title', 'פינוי, הריסה ובנייה', 'text', 'הדיירים מתפנים, והבניינים החדשים נבנים.')),
        'sources', jsonb_build_array('מאגר מתחמי ההתחדשות העירונית')),
      jsonb_build_object('id', 'glossary', 'title', 'מילון קצר', 'terms', jsonb_build_array(
        jsonb_build_object('term', 'פינוי-בינוי', 'def', 'הריסה של בניינים ישנים ובנייה של בניינים חדשים במקומם, עם יותר דירות. בעלי הדירות מקבלים דירה חדשה.'),
        jsonb_build_object('term', 'מתחם מוכרז', 'def', 'מתחם שהממשלה הכריזה עליו כמתחם להתחדשות עירונית, עם הטבות מס ותמיכה בתכנון.')))),
    'disclaimer', 'עמוד בסיסי מהנתונים הפתוחים. המסמכים המחייבים הם מסמכי התוכנית באתר תכנון זמין.',
    'reviewed', false,
    'level', 'basic')
  from plan_projects p left join quarters q on q.id = p.quarter_id
  where p.id = p_id;
$$;

revoke all on all functions in schema plan_builders from public, anon, authenticated;
