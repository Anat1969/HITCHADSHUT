-- 3D model for 3/03/101/71א (עורף נמל אשדוד, תוכנית 71/101/02/3 א', 2006). Scanned documents, no KML.
-- Lots: blocks traced from the scanned proposed-state drawing by fill colour and the drawn lot lines, georeferenced
-- to the grid ticks on the drawing frame (old Israeli grid, 25 ticks, RMS 2.8 m, converted to ITM; checked against
-- city GIS buildings). A block may hold several plan lots; rights per block = table 8b percentages x block area (estimate).
-- Requires migration 20261105000000_plan_builders_full_model_industry.sql. Set v_sha to a pushed commit.
select extensions.http_set_curlopt('CURLOPT_TIMEOUT', '60');
select extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '20');
do $$
declare
  v_sha text := '<sha>';
  base text := 'https://raw.githubusercontent.com/Anat1969/HITCHADSHUT/' || v_sha || '/supabase/seed/3-03-101-71a';
begin
  if not exists (select 1 from plan_models where plan_number = '3/03/101/71א') then
    perform plan_builders.basic_model('3/03/101/71א', 150);
  end if;
  perform plan_builders.full_model('3/03/101/71א',
    (extensions.http_get(base || '.lots.geojson')).content::jsonb,
    (extensions.http_get(base || '.table5.json')).content::jsonb,
    'מגרשים: בלוקים מהתשריט הסרוק לפי צבע הייעוד וקווי המגרשים, מעוגן לסימוני הרשת שעל המסגרת (הערכה)', null);
end $$;
-- Page wording for a plan without housing.
update plan_models set model = jsonb_set(jsonb_set(jsonb_set(model,
  '{ui,summary_label}', to_jsonb('עורף נמל אשדוד · ' || jsonb_array_length(model->'lots') || ' אזורי בנייה מהתשריט'::text)),
  '{ui,hint}', to_jsonb('הבלוקים והייעודים מהתשריט הסרוק, הזכויות מטבלה 8ב בהוראות. כל בלוק יכול לכלול כמה מגרשים, והנפח הוא הערכה. לחיצה על בלוק מציגה את הזכויות.'::text)),
  '{ui,modes,after}', to_jsonb('נפח לדוגמה: השטח מעל הקרקע לפי טבלה 8ב חלקי מספר הקומות, עד התכסית המותרת. הערכה, לא תכנון הבינוי.'::text))
where plan_number = '3/03/101/71א';
