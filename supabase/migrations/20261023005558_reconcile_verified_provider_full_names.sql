set lock_timeout='2s';set statement_timeout='60s';
create or replace function public.reconcile_football_profile_names(p_source_ids text[] default null,p_limit integer default 1000)
returns integer language plpgsql set search_path='' as $function$
declare changed integer;
begin
 if p_source_ids is not null and cardinality(p_source_ids)>250 then raise exception 'Identity batch exceeds 250 IDs' using errcode='22023';end if;
 with pairs as materialized (
 select a.id as alias_id,b.id as canonical_id,
 count(*) over(partition by a.id) as alias_matches,count(*) over(partition by b.id) as canonical_matches
 from public.players a
 left join public.club_catalog_links la on la.source_club_id=a.club_id
 join public.api_football_data d on d.kind='player_profile' and d.ref=a.source_id
 join public.players b on b.birth_date=a.birth_date and b.source='thesportsdb' and b.source_kind='player' and b.canonical_player_id is null
 left join public.club_catalog_links lb on lb.source_club_id=b.club_id
 where a.source='api-football' and a.source_kind='player' and a.canonical_player_id is null and a.birth_date is not null
 and (p_source_ids is null or a.source_id=any(p_source_ids))
 and coalesce(la.club_id,a.club_id)=coalesce(lb.club_id,b.club_id)
 and length(trim(d.payload->'player'->>'firstname')) between 1 and 100
 and length(trim(d.payload->'player'->>'lastname')) between 1 and 100
 and regexp_replace(lower(extensions.unaccent(concat_ws(' ',d.payload->'player'->>'firstname',d.payload->'player'->>'lastname'))),'[^a-z0-9]','','g')
 =regexp_replace(lower(extensions.unaccent(b.name)),'[^a-z0-9]','','g')
 ), eligible as (
 select * from pairs where alias_matches=1 and canonical_matches=1 order by alias_id limit least(5000,greatest(1,coalesce(p_limit,1000)))
 ), updated as (
 update public.players p set canonical_player_id=e.canonical_id from eligible e where p.id=e.alias_id and p.canonical_player_id is null
 returning p.id,p.canonical_player_id,p.source,p.source_id
 )
 insert into public.player_identity_aliases(player_id,canonical_player_id,source,source_id,match_rule)
 select id,canonical_player_id,source,source_id,'provider-full-name-birth-club' from updated on conflict(player_id) do nothing;
 get diagnostics changed=row_count;return changed;
end $function$;
revoke all on function public.reconcile_football_profile_names(text[],integer) from public,anon,authenticated;
grant execute on function public.reconcile_football_profile_names(text[],integer) to service_role;
select public.reconcile_football_profile_names(null,5000);

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
 perform public.reconcile_football_profile_names(array(select x.source_id from jsonb_to_recordset(p_profiles) as x(source_id text) where x.source_id is not null),250);
 return changed;
end $function$;
revoke all on function public.enrich_existing_football_profiles(jsonb) from public,anon,authenticated;
grant execute on function public.enrich_existing_football_profiles(jsonb) to service_role;
