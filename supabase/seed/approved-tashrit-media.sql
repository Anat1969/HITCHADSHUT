-- Approved-state drawings (נספח מצב מאושר), found in Drive under "מסמכי רקע" of each compound.
-- Files: public/plans/<slug>/docs/tashrit-approved*.pdf. Idempotent.
insert into plan_media (project_id, kind, url, caption, sort)
select p.id, 'document', v.url, v.caption, v.sort from (values
 ('תמל/2023','/plans/tamal-2023/docs/tashrit-approved-1.pdf','נספח מצב מאושר, מתחם אחד העם (רקע)',20),
 ('תמל/2023','/plans/tamal-2023/docs/tashrit-approved-2.pdf','נספח מצב מאושר, מתחם בית הספר (רקע)',21),
 ('תמל/2047','/plans/tamal-2047/docs/tashrit-approved.pdf','נספח מצב מאושר (רקע)',20)
) as v(plan_number,url,caption,sort)
join plan_projects p on p.plan_number = v.plan_number
where not exists (select 1 from plan_media m where m.project_id = p.id and m.url = v.url);
