-- 603-0590729, מתחם סוהו, רח' האורגים (אזור התעשייה הצפוני, ליד רובע ב').
-- Boundary: union of the lots traced from the תשריט מצב מוצע, georeferenced by its ITM grid ticks (64,452 מ"ר; סעיף 1.2: 64.350 דונם).
insert into plan_projects (title, kind, status, plan_number, quarter_id, address, summary, description, developer, units_existing, units_planned, floors, geojson, center, published)
select 'מתחם סוהו', 'new_construction', 'approved', '603-0590729', 'q-b',
 'רחוב האורגים, בין רחוב ויצמן לשדרות בן גוריון, אזור התעשייה הצפוני',
 'מתחם מסחר ותעשייה ישן ברחוב האורגים יהפוך לשכונה מעורבת: 1,100 דירות, ארבעה מגדלי משרדים מעל מסד מסחרי, בית ספר יסודי, גני ילדים ופארק שכונתי. בניין המסחר הקיים ותחנת הדלק נשארים.',
 'תוכנית מס'' 603-0590729, מתחם סוהו, רח'' האורגים, אשדוד. תוכנית מתאר מקומית עם הוראות של תוכנית מפורטת, 64.35 דונם (סעיף 1.2). מגישים: אלבר שירותי מימונית, הכשרה חברה לביטוח ופנינת אפרידר (סעיף 1.8.1). עורך: אמיר מן עמי שנער אדריכלים. הוועדה המחוזית דרום החליטה לאשר את התוכנית ב-19/02/2024 (חותמת האישור בתשריט, 24/09/2024).',
 'אלבר, הכשרה חברה לביטוח, פנינת אפרידר', 0, 1100, '9 עד 27 קומות מגורים, מגדלי משרדים של 22 קומות',
 $g${"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"name": "גבול התוכנית 603-0590729", "source": "איחוד תאי השטח מתשריט מצב מוצע, מעוגן לשנתות רשת ITM (הקו הכחול, בקירוב)"}, "geometry": {"type": "Polygon", "coordinates": [[[34.6594158, 31.8099418], [34.6603048, 31.8112832], [34.6603234, 31.8113023], [34.6603433, 31.8113155], [34.6603707, 31.8113266], [34.6603964, 31.8113313], [34.6604268, 31.811331], [34.6604534, 31.8113254], [34.6628174, 31.8104856], [34.6633031, 31.8103074], [34.6627347, 31.8091433], [34.6625608, 31.8092075], [34.6625543, 31.8092059], [34.6621547, 31.8083934], [34.6594158, 31.8099418]]]}}]}$g$::jsonb, '[34.661384, 31.809968]'::jsonb, true
where not exists (select 1 from plan_projects where plan_number = '603-0590729');

-- Source documents, served from public/plans/603-0590729/docs (from the planning documents folder in Drive).
insert into plan_media (project_id, kind, url, caption, sort)
select p.id, v.kind, v.url, v.caption, v.sort from plan_projects p, (values
 ('drawing','/plans/603-0590729/docs/tashrit-mutza.jpg','תשריט מצב מוצע, 1:500 (חיתוך של אזור התוכנית)',1),
 ('document','/plans/603-0590729/docs/horaot.pdf','הוראות התוכנית (29 עמודים, תדפיס 12/08/2024)',2),
 ('document','/plans/603-0590729/docs/tashrit.pdf','תשריט מצב מוצע, בקובץ המקורי, עם חותמת האישור',3)
) as v(kind,url,caption,sort)
where p.plan_number = '603-0590729' and not exists (select 1 from plan_media m where m.project_id = p.id and m.url = v.url);
update plan_projects set cover_media_id = (select m.id from plan_media m join plan_projects p on p.id = m.project_id
  where p.plan_number = '603-0590729' and m.url like '%tashrit-mutza.jpg')
where plan_number = '603-0590729';
