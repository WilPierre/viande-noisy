-- ============================================================
-- Viande Noisy — favoris, nouveautés, membres
-- À lancer AVANT de déployer le nouvel App.jsx
-- Supabase → SQL Editor → Run
-- ============================================================

-- 1) Blocage d'un compte (contrôle a posteriori, sans friction
--    à l'inscription). Par défaut personne n'est bloqué.
alter table viande_clients
  add column if not exists bloque boolean not null default false;

-- 2) Date d'ajout des produits, pour le badge « Nouveau »
alter table viande_produits
  add column if not exists created_at timestamptz not null default now();

-- On antidate l'existant : sans ça, tout le catalogue passerait
-- pour une nouveauté au premier chargement.
update viande_produits
set created_at = now() - interval '60 days'
where created_at > now() - interval '1 minute';

-- 3) Favoris
create table if not exists viande_favoris (
  user_id     uuid not null references auth.users(id) on delete cascade,
  produit_id  uuid not null references viande_produits(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, produit_id)
);

alter table viande_favoris enable row level security;

drop policy if exists favoris_lecture    on viande_favoris;
drop policy if exists favoris_ajout      on viande_favoris;
drop policy if exists favoris_suppression on viande_favoris;

-- chacun ne voit et ne gère que ses propres favoris
create policy favoris_lecture     on viande_favoris for select using (auth.uid() = user_id);
create policy favoris_ajout       on viande_favoris for insert with check (auth.uid() = user_id);
create policy favoris_suppression on viande_favoris for delete using (auth.uid() = user_id);

-- 4) Contrôle
select count(*) as nb_comptes, count(*) filter (where bloque) as bloques
from viande_clients;

select nom, created_at::date as ajoute_le,
       (created_at > now() - interval '5 days') as nouveau
from viande_produits
order by created_at desc
limit 10;
