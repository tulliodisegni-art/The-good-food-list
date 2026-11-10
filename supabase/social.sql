-- Cozy Spots : profils, abonnements (sur demande) et adresses partagées avec ses abonnés.
-- À coller une fois dans Supabase (projet des comptes, celui de Jobello) : SQL Editor, puis « Run ».

create table if not exists public.gf_profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9._]{3,20}$'),
  name text,
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.gf_follows (
  follower uuid not null references auth.users on delete cascade,
  followee uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create table if not exists public.gf_shared (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);
alter table public.gf_profiles enable row level security;
alter table public.gf_follows enable row level security;
alter table public.gf_shared enable row level security;

-- profils : visibles par les comptes connectés (pour trouver un pseudo), chacun modifie le sien
drop policy if exists "profils lisibles" on public.gf_profiles;
create policy "profils lisibles" on public.gf_profiles for select to authenticated using (true);
drop policy if exists "mon profil" on public.gf_profiles;
create policy "mon profil" on public.gf_profiles for insert to authenticated with check (user_id = auth.uid() and not is_owner);
drop policy if exists "mon profil modif" on public.gf_profiles;
create policy "mon profil modif" on public.gf_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- abonnements : je demande (en attente), la personne suivie accepte ou refuse
drop policy if exists "mes abonnements" on public.gf_follows;
create policy "mes abonnements" on public.gf_follows for select to authenticated using (follower = auth.uid() or followee = auth.uid());
drop policy if exists "demander" on public.gf_follows;
create policy "demander" on public.gf_follows for insert to authenticated with check (follower = auth.uid() and status = 'pending');
drop policy if exists "accepter" on public.gf_follows;
create policy "accepter" on public.gf_follows for update to authenticated using (followee = auth.uid()) with check (followee = auth.uid());
drop policy if exists "retirer" on public.gf_follows;
create policy "retirer" on public.gf_follows for delete to authenticated using (follower = auth.uid() or followee = auth.uid());

-- adresses partagées : visibles par leur auteur et par ses abonnés acceptés
drop policy if exists "mes adresses" on public.gf_shared;
create policy "mes adresses" on public.gf_shared for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "adresses des gens suivis" on public.gf_shared;
create policy "adresses des gens suivis" on public.gf_shared for select to authenticated using (
  exists (select 1 from public.gf_follows f where f.follower = auth.uid() and f.followee = gf_shared.owner and f.status = 'accepted'));

-- à la création d'un profil : Tullio est reconnu, et tout nouveau membre suit Tullio d'office
create or replace function public.gf_on_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  select id into t from auth.users where lower(email) = 'tulliodisegni@icloud.com' limit 1;
  if new.user_id = t then
    update gf_profiles set is_owner = true where user_id = new.user_id;
  elsif t is not null then
    insert into gf_follows (follower, followee, status) values (new.user_id, t, 'accepted') on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists gf_profile_created on public.gf_profiles;
create trigger gf_profile_created after insert on public.gf_profiles for each row execute function public.gf_on_profile();

revoke update on public.gf_profiles from authenticated;
grant select, insert on public.gf_profiles to authenticated;
grant update (handle, name) on public.gf_profiles to authenticated;
grant select, insert, update, delete on public.gf_follows to authenticated;
grant select, insert, update, delete on public.gf_shared to authenticated;
