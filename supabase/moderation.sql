-- Cozy Spots : signaler un contenu et bloquer un membre (règle 1.2 de l'App Store, contenus entre membres).
-- Projet des comptes (celui de Jobello). À coller une fois dans le SQL Editor, puis « Run ».

-- 1. Signalements : chacun peut signaler une adresse, un avis ou un membre. Seul le propriétaire les lit (tableau de bord Supabase).
create table if not exists public.gf_reports (
  id bigint generated always as identity primary key,
  reporter uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('membre', 'adresse', 'avis')),
  target text not null check (char_length(target) between 1 and 200),
  target_user uuid references auth.users on delete set null,
  label text check (char_length(label) <= 200),
  reason text check (char_length(reason) <= 1000),
  status text not null default 'nouveau' check (status in ('nouveau', 'traite')),
  created_at timestamptz not null default now()
);
alter table public.gf_reports enable row level security;
drop policy if exists "signaler" on public.gf_reports;
create policy "signaler" on public.gf_reports for insert to authenticated with check (reporter = auth.uid() and status = 'nouveau');
drop policy if exists "mes signalements" on public.gf_reports;
create policy "mes signalements" on public.gf_reports for select to authenticated using (reporter = auth.uid());
grant select, insert on public.gf_reports to authenticated;

-- Le propriétaire est prévenu par notification (sous 24 h, comme Apple le demande).
create or replace function public.gf_on_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  select user_id into t from gf_profiles where is_owner limit 1;
  if t is not null then
    insert into push_queue (user_id, app, key, kind, send_at, title, body, url)
    values (t, 'goodfood', 'signalement:' || new.id, 'social', now(), 'Nouveau signalement',
            'Un ' || new.kind || ' a été signalé' || coalesce(' : ' || left(new.label, 80), '') || '.', '#accueil')
    on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.gf_on_report() from public, anon, authenticated;
drop trigger if exists gf_report_created on public.gf_reports;
create trigger gf_report_created after insert on public.gf_reports for each row execute function public.gf_on_report();

-- Les signalements sont gardés 1 an (promis dans la politique de confidentialité).
select cron.unschedule(jobid) from cron.job where jobname = 'gf-purge-signalements';
select cron.schedule('gf-purge-signalements', '23 4 * * *', $$delete from public.gf_reports where created_at < now() - interval '1 year'$$);

-- 2. Blocages : un membre bloqué ne voit plus mes adresses, ne peut plus me demander de me suivre, et je ne vois plus les siennes.
create table if not exists public.gf_blocks (
  blocker uuid not null default auth.uid() references auth.users on delete cascade,
  blocked uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.gf_blocks enable row level security;
drop policy if exists "mes blocages" on public.gf_blocks;
create policy "mes blocages" on public.gf_blocks for select to authenticated using (blocker = auth.uid());
drop policy if exists "debloquer" on public.gf_blocks;
create policy "debloquer" on public.gf_blocks for delete to authenticated using (blocker = auth.uid());
grant select, delete on public.gf_blocks to authenticated;

-- Bloquer = enregistrer le blocage et couper les abonnements dans les deux sens, en une fois.
create or replace function public.gf_block(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'connexion nécessaire'; end if;
  if p_user is null or p_user = auth.uid() then raise exception 'membre invalide'; end if;
  if exists (select 1 from gf_profiles where user_id = p_user and is_owner) then raise exception 'impossible de bloquer la liste de base'; end if;
  insert into gf_blocks (blocker, blocked) values (auth.uid(), p_user) on conflict do nothing;
  delete from gf_follows where (follower = auth.uid() and followee = p_user) or (follower = p_user and followee = auth.uid());
end $$;
revoke all on function public.gf_block(uuid) from public, anon;
grant execute on function public.gf_block(uuid) to authenticated;

-- Une demande d'abonnement est refusée si l'une des deux personnes a bloqué l'autre.
-- (Fonction « security definer » : chacun ne voit que ses propres blocages, mais le contrôle doit voir les deux sens.)
create or replace function public.gf_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from gf_blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a))
$$;
revoke all on function public.gf_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.gf_blocked_between(uuid, uuid) to authenticated;
drop policy if exists "demander" on public.gf_follows;
create policy "demander" on public.gf_follows for insert to authenticated with check (
  follower = auth.uid() and status = 'pending' and not public.gf_blocked_between(auth.uid(), followee));
