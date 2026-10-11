-- Plan drawings (תשריט sheets) are their own media kind, separate from renders.
alter table public.plan_media drop constraint if exists plan_media_kind_check;
alter table public.plan_media add constraint plan_media_kind_check check (kind in ('render','video','video_link','kml','document','drawing'));
