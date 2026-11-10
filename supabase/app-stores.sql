-- Cozy Spots sur l'App Store et Google Play : suppression du compte et notifications des amis.
-- Installé le 10/11/2026 dans le projet des comptes (celui de Jobello). À relancer tel quel si besoin : SQL Editor, puis « Run ».
-- Sans danger pour les autres applis : rien n'est modifié, on ajoute des fonctions et deux déclencheurs sur les tables gf_*.

-- 1. Supprimer son compte depuis l'appli (exigé par Apple et Google).
--    Toutes les tables liées au compte sont en « on delete cascade » : notes, abonnements, notifications… partent avec.
--    Les photos (Storage) sont effacées par l'appli juste avant (account.js).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'connexion nécessaire'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 2. Notifications Cozy Spots : elles passent par la file « push_queue » déjà utilisée par Jobello.
--    La fonction « notifications » (supabase/functions/notifications) les envoie aux iPhone (APNs),
--    aux Android (Firebase) et aux navigateurs (Web Push), chaque minute.
create or replace function public.gf_handle(u uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select '@' || handle from gf_profiles where user_id = u), 'Quelqu''un')
$$;
revoke all on function public.gf_handle(uuid) from public, anon, authenticated;

-- Demande d'abonnement reçue, puis acceptée.
create or replace function public.gf_push_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into push_queue (user_id, app, key, kind, send_at, title, body, url)
    values (new.followee, 'goodfood', 'demande:' || new.follower, 'social', now(),
            'Nouvelle demande', gf_handle(new.follower) || ' veut suivre tes adresses.', '#accueil')
    on conflict (user_id, app, key) do update set send_at = now(), sent_at = null, title = excluded.title, body = excluded.body;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into push_queue (user_id, app, key, kind, send_at, title, body, url)
    values (new.follower, 'goodfood', 'accepte:' || new.followee, 'social', now(),
            'Demande acceptée', gf_handle(new.followee) || ' a accepté : tu vois maintenant ses adresses.', '#accueil')
    on conflict (user_id, app, key) do update set send_at = now(), sent_at = null, title = excluded.title, body = excluded.body;
  end if;
  return new;
end $$;
drop trigger if exists gf_push_follow on public.gf_follows;
create trigger gf_push_follow after insert or update of status on public.gf_follows
  for each row execute function public.gf_push_follow();

-- Nouvelle adresse d'un ami : une notification par ami et par heure au plus, envoyée 10 minutes après
-- (si plusieurs adresses arrivent d'un coup, on n'envoie qu'un message groupé).
create or replace function public.gf_push_shared() returns trigger
language plpgsql security definer set search_path = public as $$
declare nom text := coalesce(new.data->>'name', 'une adresse'); qui text := gf_handle(new.owner);
begin
  insert into push_queue (user_id, app, key, kind, send_at, title, body, url)
  select f.follower, 'goodfood', 'ajout:' || new.owner || ':' || to_char(now(), 'YYYYMMDDHH24'), 'amis', now() + interval '10 minutes',
         'Nouvelle adresse', qui || ' a ajouté ' || nom || '.', '#accueil'
  from gf_follows f where f.followee = new.owner and f.status = 'accepted'
  on conflict (user_id, app, key) do update set body = qui || ' a ajouté plusieurs adresses.'
    where push_queue.sent_at is null;
  return new;
end $$;
drop trigger if exists gf_push_shared on public.gf_shared;
create trigger gf_push_shared after insert on public.gf_shared
  for each row execute function public.gf_push_shared();

-- Les fonctions de déclenchement ne servent qu'aux déclencheurs : pas d'appel direct depuis l'API.
revoke all on function public.gf_push_follow() from public, anon, authenticated;
revoke all on function public.gf_push_shared() from public, anon, authenticated;
