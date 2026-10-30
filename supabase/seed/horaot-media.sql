-- Provisions PDFs for plans that had no provisions document attached.
-- Files: public/plans/<slug>/docs/horaot.pdf, downloaded from Drive "2. תבעות" (plan number checked on page 1).
-- Idempotent: skips a plan that already has this URL.
insert into plan_media (project_id, kind, url, caption, sort)
select p.id, 'document', v.url, v.caption, 0 from (values
 ('603-1259092','/plans/603-1259092/docs/horaot.pdf','הוראות התוכנית (26 עמודים, תדפיס חתום להפקדה)'),
 ('603-0346031','/plans/603-0346031/docs/horaot.pdf','הוראות התוכנית (28 עמודים, חתום לאישור)'),
 ('3/03/102/94','/plans/3-03-102-94/docs/horaot.pdf','הוראות התוכנית (19 עמודים, מאושרות, סרוק)'),
 ('603-0704064','/plans/603-0704064/docs/horaot.pdf','הוראות התוכנית (26 עמודים)'),
 ('תמל/2021','/plans/tamal-2021/docs/horaot.pdf','הוראות התוכנית (34 עמודים)'),
 ('603-1097815','/plans/603-1097815/docs/horaot.pdf','הוראות התוכנית (25 עמודים, חתום לאישור)'),
 ('603-0391219','/plans/603-0391219/docs/horaot.pdf','הוראות התוכנית (40 עמודים)'),
 ('תמל/2024','/plans/tamal-2024/docs/horaot.pdf','הוראות התוכנית (28 עמודים)'),
 ('603-0993790','/plans/603-0993790/docs/horaot.pdf','הוראות התוכנית (26 עמודים, תדפיס חתום להפקדה)'),
 ('603-0780734','/plans/603-0780734/docs/horaot.pdf','הוראות התוכנית (26 עמודים)'),
 ('תמל/2047','/plans/tamal-2047/docs/horaot.pdf','הוראות התוכנית (30 עמודים)'),
 ('תמל/2023','/plans/tamal-2023/docs/horaot.pdf','הוראות התוכנית (26 עמודים)')
) as v(plan_number,url,caption)
join plan_projects p on p.plan_number = v.plan_number
where not exists (select 1 from plan_media m where m.project_id = p.id and m.url = v.url);
