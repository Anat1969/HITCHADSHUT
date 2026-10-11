-- Source documents for plan 603-0811588, served from public/plans/603-0811588/docs
insert into plan_media (project_id, kind, url, caption, sort)
select p.id, v.kind, v.url, v.caption, v.sort from plan_projects p, (values
 ('render','/plans/603-0811588/docs/tashrit-1.jpg','התשריט, גיליון 1: כל המגרשים בתוכנית',1),
 ('render','/plans/603-0811588/docs/tashrit-2.jpg','התשריט, גיליון 2: פירוט המגרשים',2),
 ('render','/plans/603-0811588/docs/tashrit-3.jpg','התשריט, גיליון 3: פירוט המגרשים',3),
 ('document','/plans/603-0811588/docs/horaot.pdf','הוראות התוכנית המלאות (28 עמודים)',4),
 ('document','/plans/603-0811588/docs/tashrit-1.pdf','התשריט, גיליון 1, בקובץ המקורי',5),
 ('document','/plans/603-0811588/docs/tashrit-2.pdf','התשריט, גיליון 2, בקובץ המקורי',6),
 ('document','/plans/603-0811588/docs/tashrit-3.pdf','התשריט, גיליון 3, בקובץ המקורי',7),
 ('kml','/plans/603-0811588/docs/gvul.kml','גבול התוכנית',8)
) as v(kind,url,caption,sort) where p.plan_number = '603-0811588';
