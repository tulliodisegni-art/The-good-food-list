-- Cozy Spots, projet Supabase « Good Food » (avis des amis, adresses publiées pour tous, lectures par l'IA).
-- À coller une fois dans le SQL Editor de ce projet. Sans effet sur ce qui existe déjà.

-- 1. Garde-fous : les avis et les adresses publiées s'écrivent sans compte (clé publique), on borne donc leur taille.
alter table public.avis drop constraint if exists avis_tailles;
alter table public.avis add constraint avis_tailles check (
  char_length(author) between 1 and 40 and char_length(coalesce(comment, '')) <= 1000
  and char_length(place_id) <= 100 and char_length(coalesce(place_name, '')) <= 200) not valid;
alter table public.ajouts drop constraint if exists ajouts_tailles;
alter table public.ajouts add constraint ajouts_tailles check (
  char_length(coalesce(author, '')) <= 40 and octet_length(place::text) <= 20000) not valid;

-- 2. La politique de confidentialité promet que le résultat d'une lecture par l'IA est gardé 30 jours au plus :
--    chaque nuit, on efface les lectures plus anciennes.
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'purge-lectures';
select cron.schedule('purge-lectures', '41 3 * * *', $$delete from public.lectures where created_at < now() - interval '30 days'$$);
