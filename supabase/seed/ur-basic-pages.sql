-- Basic plan pages for every urban renewal compound without plan documents yet.
-- Requires migration 20261017010000_plan_basic_builders.sql (+ the city-GIS version of basic_model, applied 17/10/2026).
-- Re-run after ur-compounds-ashdod.sql adds new compounds. A full story (level "full") is never overwritten.

-- 3D model, today's state: compound boundary + building footprints from the Ashdod municipal GIS
-- (mapt_reka/MapServer/31, layers 2200/2201). One call per plan keeps each request short.
select plan_builders.basic_model(plan_number)
from plan_projects
where source_id like 'ur:%' and published and geojson is not null
  and plan_number not in (select plan_number from plan_models where source <> 'plan_builders.basic_model');

-- Story from the national open data.
update plan_projects p set story = plan_builders.basic_story(p.id), model_url = null
where p.source_id like 'ur:%' and (p.story is null or p.story->>'level' = 'basic');
