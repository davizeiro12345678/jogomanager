set lock_timeout='2s';
set statement_timeout='60s';
create table public.club_catalog_links (
  source_club_id text primary key references public.clubs(id) on delete cascade,
  club_id text not null references public.clubs(id) on delete cascade,
  source text not null check(source in ('api-football','thesportsdb')),
  source_team_id text references public.official_teams(source_id) on delete set null,
  match_rule text not null default 'unique-normalized-name-country',
  metadata_before jsonb not null,
  reviewed_at timestamptz not null default now(),
  check(club_id <> source_club_id)
);
create index club_catalog_links_club_idx on public.club_catalog_links(club_id);
alter table public.club_catalog_links enable row level security;
revoke all on public.club_catalog_links from anon, authenticated;
grant select on public.club_catalog_links to anon, authenticated;
grant all on public.club_catalog_links to service_role;
create policy "Club identity links are public" on public.club_catalog_links for select to anon,authenticated using(true);

-- Only one-to-one matches qualify. IDs, strengths, competition memberships,
-- player ownership and career JSON are never rewritten by reconciliation.
with countries as (
select * from (values ('brasil','brazil'),('inglaterra','england'),('espanha','spain'),('italia','italy'),('alemanha','germany'),('franca','france'),('holanda','netherlands'),('paises baixos','netherlands'),('belgica','belgium'),('escocia','scotland'),('turquia','turkey'),('suica','switzerland'),('grecia','greece'),('croacia','croatia'),('dinamarca','denmark'),('suecia','sweden'),('noruega','norway'),('polonia','poland'),('estados unidos','usa'),('united states','usa')) as x(local_name,provider_name)
), normalized as (
select c.*,regexp_replace(lower(extensions.unaccent(c.name)),'[^a-z0-9]','','g') as name_key,coalesce(m.provider_name,lower(extensions.unaccent(trim(c.country)))) as country_key
from public.clubs c left join countries m on m.local_name=lower(extensions.unaccent(trim(c.country))) where c.country is not null
), bundled as (
select *,count(*) over(partition by name_key,country_key) as choices from normalized where data_source='bundled'
), providers as (
select *,count(*) over(partition by name_key,country_key) as choices from normalized where data_source='api-football' and source_id~'^[0-9]+$'
), pairs as (
select b.id as club_id,p.id as source_club_id,p.source_id,p.crest_url,p.city,p.founded,p.stadium_id,b.name,b.country
from bundled b join providers p using(name_key,country_key) where b.choices=1 and p.choices=1
)

insert into public.club_catalog_links(source_club_id,club_id,source,source_team_id,metadata_before)
select p.source_club_id,p.club_id,'api-football',t.source_id,
 jsonb_build_object('crest_url',c.crest_url,'city',c.city,'founded',c.founded,'stadium_id',c.stadium_id)
from pairs p join public.clubs c on c.id=p.club_id
left join public.official_teams t on t.source_id='af:'||p.source_id
on conflict(source_club_id) do nothing;

update public.clubs c set
 crest_url=coalesce(c.crest_url,case when s.crest_url like 'https://%' then s.crest_url end),
 city=coalesce(c.city,s.city), founded=coalesce(c.founded,s.founded),stadium_id=coalesce(c.stadium_id,s.stadium_id)
from public.club_catalog_links l join public.clubs s on s.id=l.source_club_id
where c.id=l.club_id and (c.crest_url is null or c.city is null or c.founded is null or c.stadium_id is null);

update public.official_teams t set local_club_id=l.club_id
from public.club_catalog_links l where t.source_id=l.source_team_id and t.local_club_id is null;
