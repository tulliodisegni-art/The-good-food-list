-- Cozy Spots, projet « Good Food » (avis, adresses publiées, lectures par l'IA).
-- La politique de confidentialité promet que le résultat d'une lecture par l'IA est gardé 30 jours au plus :
-- chaque nuit, on efface les lectures plus anciennes. À coller une fois dans le SQL Editor de ce projet.
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'purge-lectures';
select cron.schedule('purge-lectures', '41 3 * * *', $$delete from public.lectures where created_at < now() - interval '30 days'$$);
delete from public.lectures where created_at < now() - interval '30 days';
