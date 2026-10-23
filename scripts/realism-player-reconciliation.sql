set lock_timeout='2s'; set statement_timeout='60s';
create table public.player_identity_aliases(
 player_id uuid primary key references public.players(id) on delete cascade,
 canonical_player_id uuid not null references public.players(id) on delete cascade,
 source text, source_id text,
 match_rule text not null default 'verified-birth-club-and-name',
 reviewed_at timestamptz not null default now(),
 check(player_id<>canonical_player_id)
);
create index player_identity_aliases_canonical_idx on public.player_identity_aliases(canonical_player_id);
alter table public.player_identity_aliases enable row level security;
revoke all on public.player_identity_aliases from anon,authenticated;
grant select on public.player_identity_aliases to anon,authenticated;
grant all on public.player_identity_aliases to service_role;
create policy "Read public athlete identity aliases" on public.player_identity_aliases for select to anon,authenticated using(exists(
 select 1 from public.players p where p.id=player_identity_aliases.canonical_player_id and p.source_kind='player' and p.canonical_player_id is null
));
insert into public.player_identity_aliases(player_id,canonical_player_id,source,source_id,match_rule)
select id,canonical_player_id,source,source_id,'existing-canonical-link' from public.players
 where source_kind='player' and canonical_player_id is not null on conflict(player_id) do nothing;

create or replace function public.reconcile_football_player_aliases(p_source_ids text[] default null,p_limit integer default 1000)
returns integer language plpgsql set search_path='' as $function$
declare changed integer;
begin
 if p_source_ids is not null and cardinality(p_source_ids)>250 then
  raise exception 'Identity batch exceeds 250 provider IDs' using errcode='22023';
 end if;
 with identities as (
select p.id,p.name,p.birth_date,p.source,p.source_id,p.club_id,coalesce(l.club_id,p.club_id) as catalog_club,
regexp_replace(lower(extensions.unaccent(p.name)),'[^a-z0-9]','','g') as name_key,
left(regexp_replace(lower(extensions.unaccent(p.name)),'[^a-z0-9]','','g'),1) as initial,
regexp_replace(lower(extensions.unaccent(regexp_replace(trim(p.name),'^.*[[:space:]]',''))),'[^a-z0-9]','','g') as surname,
p.name ~ '^[[:alpha:]][.]' as abbreviated
from public.players p left join public.club_catalog_links l on l.source_club_id=p.club_id
where p.source_kind='player' and p.canonical_player_id is null and p.birth_date is not null
and p.source in ('api-football','thesportsdb') and p.club_id is not null
),
 matching as (
 select catalog_club,birth_date,initial,surname from identities
 group by catalog_club,birth_date,initial,surname
 having count(*)=2 and count(distinct source)=2 and (count(distinct name_key)=1 or bool_or(abbreviated))
 and (p_source_ids is null or bool_or(source='api-football' and source_id=any(p_source_ids)))
 order by catalog_club,birth_date,initial,surname limit least(5000,greatest(1,coalesce(p_limit,1000)))
 ), ranked as (
 select i.*,first_value(i.id) over(partition by i.catalog_club,i.birth_date,i.initial,i.surname
 order by (i.club_id=i.catalog_club) desc,(i.source='thesportsdb') desc,i.id) as canonical_id
 from identities i join matching m using(catalog_club,birth_date,initial,surname)
 ), updated as (
 update public.players p set canonical_player_id=r.canonical_id from ranked r
 where p.id=r.id and r.id<>r.canonical_id and p.canonical_player_id is null
 returning p.id,p.canonical_player_id,p.source,p.source_id
 )
 insert into public.player_identity_aliases(player_id,canonical_player_id,source,source_id)
 select id,canonical_player_id,source,source_id from updated on conflict(player_id) do nothing;
 get diagnostics changed=row_count; return changed;
end $function$;
revoke all on function public.reconcile_football_player_aliases(text[],integer) from public,anon,authenticated;
grant execute on function public.reconcile_football_player_aliases(text[],integer) to service_role;

select public.reconcile_football_player_aliases(null,5000);
