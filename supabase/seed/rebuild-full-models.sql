-- Rebuilds every plan model built from a drawing (lots + table 5 + building lines) with the current
-- plan_builders.full_model. Files are read from GitHub raw at one commit: set v_sha to a pushed commit.
-- Plans whose lots come from registered parcels have their own seed files: 3-03-104-67.model.sql, 3-03-102-94.model.sql.
select extensions.http_set_curlopt('CURLOPT_TIMEOUT', '60');
do $$
declare
  v_sha text := '<sha>';
  r record;
  base text;
  env jsonb;
begin
  for r in select * from (values
    ('תמל/2021', 'tamal-2021', true), ('תמל/2023', 'tamal-2023', true), ('תמל/2024', 'tamal-2024', true),
    ('תמל/2047', 'tamal-2047', true), ('603-0704064', '603-0704064', true), ('603-0391219', '603-0391219', true),
    ('603-0346031', '603-0346031', true), ('603-1259092', '603-1259092', true), ('603-0993790', '603-0993790', true),
    ('603-1097815', '603-1097815', true), ('603-0780734', '603-0780734', true), ('603-1510577', '603-1510577', true),
    ('3/03/104/66', '3-03-104-66', true), ('603-0271296', '603-0271296', false)
  ) v(plan, slug, has_env) loop
    base := 'https://raw.githubusercontent.com/Anat1969/HITCHADSHUT/' || v_sha || '/supabase/seed/' || r.slug;
    env := case when r.has_env then (extensions.http_get(base || '.envelopes.geojson')).content::jsonb end;
    perform plan_builders.full_model(r.plan,
      (extensions.http_get(base || '.lots.geojson')).content::jsonb,
      (extensions.http_get(base || '.table5.json')).content::jsonb,
      null, env);
  end loop;
end $$;
