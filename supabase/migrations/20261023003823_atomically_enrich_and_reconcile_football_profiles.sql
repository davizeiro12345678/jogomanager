set lock_timeout='2s';set statement_timeout='30s';
create index players_birth_identity_idx on public.players(birth_date,club_id) where source_kind='player' and canonical_player_id is null and birth_date is not null;

create or replace function public.reconcile_football_player_aliases(p_source_ids text[] default null,p_limit integer default 1000)
returns integer language plpgsql set search_path='' as $function$
declare changed integer; focus_births date[];
begin
 if p_source_ids is not null and cardinality(p_source_ids)>250 then
  raise exception 'Identity batch exceeds 250 provider IDs' using errcode='22023';
 end if;
 if p_source_ids is not null then
  select array_agg(distinct p.birth_date) into focus_births from public.players p
   where p.source='api-football' and p.source_kind='player' and p.canonical_player_id is null
    and p.birth_date is not null and p.source_id=any(p_source_ids);
  if coalesce(cardinality(focus_births),0)=0 then return 0; end if;
 end if;
 with identities as (
select p.id,p.name,p.birth_date,p.source,p.source_id,p.club_id,coalesce(l.club_id,p.club_id) as catalog_club,
regexp_replace(lower(extensions.unaccent(p.name)),'[^a-z0-9]','','g') as name_key,
left(regexp_replace(lower(extensions.unaccent(p.name)),'[^a-z0-9]','','g'),1) as initial,
regexp_replace(lower(extensions.unaccent(regexp_replace(trim(p.name),'^.*[[:space:]]',''))),'[^a-z0-9]','','g') as surname,
p.name ~ '^[[:alpha:]][.]' as abbreviated
from public.players p left join public.club_catalog_links l on l.source_club_id=p.club_id
where p.source_kind='player' and p.canonical_player_id is null and p.birth_date is not null
and (p_source_ids is null or p.birth_date=any(focus_births))
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


create or replace function public.enrich_existing_football_profiles(p_profiles jsonb)
returns integer language plpgsql set search_path='' as $function$
declare changed integer;
begin
 if p_profiles is null or jsonb_typeof(p_profiles) <> 'array' or jsonb_array_length(p_profiles)>250 then
  raise exception 'Profile batch must be an array of at most 250 records' using errcode='22023';
 end if;
 with supplied as (
 select source_id,
 case when birth_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and pg_input_is_valid(birth_date,'date')
  then case when birth_date::date>='1880-01-01'::date and birth_date::date<current_date then birth_date::date end end as birth_date,
 case when photo_url like 'https://%' and length(photo_url)<=2048 then photo_url end as photo_url,
 case when length(nationality) between 1 and 100 then nationality end as nationality
 from jsonb_to_recordset(p_profiles) as x(source_id text,birth_date text,photo_url text,nationality text)
 )
 update public.players p set birth_date=coalesce(p.birth_date,s.birth_date),
  photo_url=coalesce(p.photo_url,s.photo_url),nationality=coalesce(p.nationality,s.nationality)
 from supplied s where p.source='api-football' and p.source_kind='player' and p.source_id=s.source_id
 and ((p.birth_date is null and s.birth_date is not null) or (p.photo_url is null and s.photo_url is not null) or (p.nationality is null and s.nationality is not null));
 get diagnostics changed=row_count;
 perform public.reconcile_football_player_aliases(array(select x.source_id from jsonb_to_recordset(p_profiles) as x(source_id text) where x.source_id is not null),250);
 return changed;
end $function$;
revoke all on function public.enrich_existing_football_profiles(jsonb) from public,anon,authenticated;
grant execute on function public.enrich_existing_football_profiles(jsonb) to service_role;
