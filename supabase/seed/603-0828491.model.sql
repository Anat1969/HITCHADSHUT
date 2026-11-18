-- Model for plan 603-0828491 (building rights on public-use plots across the city).
-- The plan has no lot list: it applies to every public-use plot inside its blue line (section 1.5.2, table 1.6 note A).
-- Lots: the city's lots/land-use layer (shchuna_gis_features, layer 'lots', lots.shp of 04.11.2026), use codes for public buildings
--   (5502 שטח לבנייני ציבור, 400/410/430/440 מבנים ומוסדות ציבור, 5506, 5520, 5522, and the combined 5606/1670),
--   at least 500 m2 (minimum plot size in table 5), point-on-surface inside the blue line, and not inside another published plan.
--   The same lots, in the same order, are in supabase/seed/603-0828491.lots.geojson (lot = position in the fid list below).
-- Envelope: 3 m inset on every side (table 5: side and rear 3 m, front 5 m; the front side of each plot is unknown). Estimate.
-- Rights: table 5, public row: 50% main + 10% service per floor, 4 floors, 19 m, 60% coverage, below ground 40% + 40%.
-- full_model draws "demolish" from all city buildings inside the boundary. This plan demolishes nothing, so the boundary is
--   swapped for a dummy point in the sea while full_model runs, and restored after it.
do $$
declare
  v_fids int[] := array[10410,10452,10460,10448,10409,389,403,402,267,203,202,232,211,251,258,224,223,263,189,188,181,312,311,313,192,191,315,9943,9817,9744,9738,9737,9578,9602,9581,9400,9442,9444,9445,9392,9391,9390,9446,9449,9404,9399,9398,9393,9340,9338,9333,9326,9387,9386,9373,9384,9383,9325,9324,9323,9322,9321,9320,9319,9381,9380,9376,9375,9374,9011,9010,9008,8805,8769,8038,8032,8039,7959,8036,8041,7898,8040,7902,8066,8064,7995,8016,7768,7761,7762,7758,7757,7756,7755,7754,7728,7742,7733,7721,7720,7719,7686,7706,7703,7698,7697,7712,7543,7503,7498,7419,7415,7506,7406,7379,7398,7365,7348,7423,7403,7345,7303,7305,7306,7307,7309,7316,7619,7618,7617,7608,7606,7095,7080,7081,7195,7185,7191,7188,7190,7167,6950,6926,6772,6857,6848,6845,6844,6843,6879,6871,6748,6766,6758,6757,6671,6663,6718,6721,6715,6689,6684,6682,6681,6614,6609,6610,6634,6642,6605,6566,6491,6531,6473,6532,6528,6371,6257,6268,6169,6179,6178,6285,6351,6287,6305,6312,6339,6348,6138,6121,6124,6085,6084,6070,6088,6066,6098,6004,6000,5996,5873,5869,5892,5888,5870,5874,5884,5804,5782,5832,5818,5650,5665,5655,5539,5547,5485,5543,5541,5502,5535,5515,5565,5470,5466,5459,5458,5455,5403,5395,5405,5411,5415,5414,5391,5432,5284,5309,5340,5345,5256,5219,5230,5222,5244,5248,5223,5249,5174,5191,5182,5192,5167,5172,5169,5171,5196,5195,5200,5199,5205,5194,5143,5141,5129,5132,5133,5151,5147,5081,5093,5052,5017,4881,4528,4459,4571,4574,4407,4267,4137,4184,4223,4101,3972,3968,3993,3995,4001,3959,3958,3951,3927,3886,3898,3889,3906,3867,3888,3912,3811,3844,3825,3828,3834,3833,3821,3820,3830,3831,3788,3795,3840,3824,3837,3817,3721,3724,3701,3423,3458,3461,3489,3499,3365,3339,3342,3330,3413,3361,3362,3395,3276,3281,3306,3258,3243,3240,3235,3238,3182,3200,3197,3198,3208,3224,3223,3222,3142,3156,3166,3162,3165,3124,3117,3116,3120,3094,3085,3086,3104,3064,3056,3055,3075,3040,3030,3027,3033,2955,2954,2953,2832,2723,2744,2609,2669,2672,2670,2680,2598,2556,2555,2557,2562,2563,2593,2545,2508,2493,2490,2488,2487,2432,2436,2430,2427,2426,2407,2408,2418,2419,2416,2398,2387,2386,2343,2320,2331,2385,2357,2356,2359,2358,2312,2292,2279,2275,2278,2200,2223,2254,2205,2238,2250,2213,2248,2196,2212,2261,2202,2242,2188,2268,2181,2122,1876,1879,1880,1931,1932,1770,1753,1727,1721,1722,1719,1716,1711,1710,1665,1670,1697,1601,1603,1539,1470,1462,1461,1450,1451,1465,1464,1291,1082,1030,1045,1034,1028,1027,1021,998,900,977,765,764,763,762,761,760,735,734,733,732,731,730,729,736,728];
  v_geo jsonb;
  v_lots jsonb; v_env jsonb; v_t5 jsonb; v_ctx jsonb; v_res jsonb;
begin
  select geojson into v_geo from plan_projects where plan_number = '603-0828491';

  with l as (
    select o.n lot, f.props p, ST_Buffer(f.geom, 0) g
    from unnest(v_fids) with ordinality o(fid, n)
    join shchuna_gis_features f on f.layer = 'lots' and f.fid = o.fid
  )
  select
    jsonb_build_object('type', 'FeatureCollection', 'features', jsonb_agg(jsonb_build_object('type', 'Feature',
      'properties', jsonb_build_object('lot', lot, 'use', 'מבנים ומוסדות ציבור', 'use_legend', 'מבנים ומוסדות ציבור', 'gis_use', p->>'use'),
      'geometry', ST_AsGeoJSON(ST_ReducePrecision(ST_Transform(ST_SimplifyPreserveTopology(g, 0.2), 4326), 0.0000001))::jsonb) order by lot)),
    jsonb_build_object('type', 'FeatureCollection', 'features', jsonb_agg(jsonb_build_object('type', 'Feature',
      'properties', jsonb_build_object('lot', lot, 'kind', 'envelope'),
      'geometry', ST_AsGeoJSON(ST_ReducePrecision(ST_Transform(ST_SimplifyPreserveTopology(ST_Buffer(g, -3, 'join=mitre'), 0.2), 4326), 0.0000001))::jsonb)
      order by lot) filter (where not ST_IsEmpty(ST_Buffer(g, -3, 'join=mitre')))),
    jsonb_build_object('plan_number', '603-0828491', 'total_units', 0, 'lots', jsonb_agg(jsonb_build_object(
      'lot', lot, 'use', 'מבנים ומוסדות ציבור', 'lot_size', round(ST_Area(g)), 'units', 0, 'floors_above', 4, 'floors_below', 1,
      'height_m', 19, 'coverage_pct', 60, 'main_above', round(2.0 * ST_Area(g)), 'service_above', round(0.4 * ST_Area(g)),
      'service_below', round(0.4 * ST_Area(g)), 'total_area', round(3.2 * ST_Area(g)),
      'ref', 'טבלה 5, שורת מבנים ומוסדות ציבור. מגרש ' || coalesce(p->>'migrash', '?') || ', גוש ' || coalesce(p->>'gush', '?') || ' חלקה ' || coalesce(p->>'helka', '?')
             || ' לפי שכבת המגרשים העירונית. השטחים במ"ר מחושבים משטח המגרש (הערכה)') order by lot))
  into v_lots, v_env, v_t5 from l;

  -- context: existing buildings on these plots (OSM footprints in shchuna_gis_features), height by known floors, else 4
  select jsonb_build_object('type', 'FeatureCollection', 'features', coalesce(jsonb_agg(jsonb_build_object('type', 'Feature',
      'properties', jsonb_build_object('h', round(least(coalesce(nullif((b.props->>'floors'), '')::numeric, 4), 30) * 3.3, 1)),
      'geometry', ST_AsGeoJSON(ST_ReducePrecision(ST_Transform(ST_SimplifyPreserveTopology(b.geom, 0.3), 4326), 0.000001))::jsonb)), '[]'::jsonb))
  into v_ctx
  from shchuna_gis_features b
  where b.layer = 'buildings' and exists (select 1 from shchuna_gis_features f
    where f.layer = 'lots' and f.fid = any(v_fids) and ST_Intersects(f.geom, ST_PointOnSurface(b.geom)));

  insert into plan_models (plan_number, model, source, updated_at)
  values ('603-0828491', jsonb_build_object(
    'plan_number', '603-0828491',
    'sources', jsonb_build_object(
      'boundary', 'גבול התוכנית: הקו הכחול בתשריט מצב מוצע, לפי העיגון הגאוגרפי שבקובץ התשריט',
      'context', 'מבנים קיימים במגרשים: טביעות OpenStreetMap; הגובה לפי מספר הקומות כשהוא ידוע, אחרת 4 קומות (הערכה)'),
    'summary', jsonb_build_object('lots', 0, 'units_after', 0),
    'ui', jsonb_build_object('summary_label', 'זכויות בנייה במגרשי ציבור בכל העיר'),
    'lots', '[]'::jsonb, 'checks', '[]'::jsonb,
    'massing', jsonb_build_object('type', 'FeatureCollection', 'features', '[]'::jsonb),
    'boundary', v_geo,
    'context', v_ctx), 'plan_builders.basic_model (by hand)', now())
  on conflict (plan_number) do update set model = excluded.model, source = excluded.source, updated_at = now();

  update plan_projects set geojson = jsonb_build_object('type', 'FeatureCollection', 'features', jsonb_build_array(jsonb_build_object(
    'type', 'Feature', 'properties', '{}'::jsonb, 'geometry', ST_AsGeoJSON(ST_Buffer(ST_SetSRID(ST_MakePoint(34.40, 31.70), 4326), 0.0001))::jsonb)))
  where plan_number = '603-0828491';

  v_res := plan_builders.full_model('603-0828491', v_lots, v_t5,
    'מגרשים: שכבת המגרשים וייעודי הקרקע של עיריית אשדוד, מגרשים בייעוד ציבורי בתוך הקו הכחול. קו בניין 3 מ'' מכל צד (הערכה)', v_env);

  update plan_projects set geojson = v_geo where plan_number = '603-0828491';
  update plan_models set model = model
      || jsonb_build_object('boundary', v_geo,
           'demolish', jsonb_build_object('type', 'FeatureCollection', 'features', '[]'::jsonb))
      || jsonb_build_object('ui', (model->'ui') || jsonb_build_object(
           'summary_label', 'זכויות בנייה במגרשי ציבור · ' || jsonb_array_length(v_lots->'features') || ' מגרשים ציבוריים',
           'hint', 'כל מגרש ציבורי בעיר, לפי שכבת המגרשים העירונית. המעטפת: 3 מ'' מגבול המגרש ועד 19 מ''. הבניין: 60% מהמגרש ב-4 קומות. הערכה, לא תכנון של מבנה מסוים.'))
  where plan_number = '603-0828491';
  raise notice '%', v_res;
end $$;
select jsonb_array_length(model->'lots') lots, jsonb_array_length(model->'massing'->'features') massing,
  jsonb_array_length(model->'context'->'features') context, jsonb_array_length(model->'demolish'->'features') demolish,
  jsonb_array_length(model->'checks') checks, length(model::text)/1024 kb
from plan_models where plan_number = '603-0828491';
