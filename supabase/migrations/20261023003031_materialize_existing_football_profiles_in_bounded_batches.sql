set lock_timeout='2s';
set statement_timeout='30s';
create or replace function public.enrich_existing_football_profiles(p_profiles jsonb)
returns integer language plpgsql set search_path='' as $function$
declare changed integer;
begin
 if jsonb_typeof(p_profiles) <> 'array' or jsonb_array_length(p_profiles)>250 then
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
 get diagnostics changed=row_count; return changed;
end $function$;
revoke all on function public.enrich_existing_football_profiles(jsonb) from public,anon,authenticated;
grant execute on function public.enrich_existing_football_profiles(jsonb) to service_role;

-- This maintenance cursor only reads existing raw profiles and existing
-- players. A batch never inserts people, changes an ID or spends provider quota.
create or replace function public.backfill_football_birth_dates(p_after uuid default null,p_limit integer default 5000)
returns table(processed integer,last_id uuid,updated integer)
language plpgsql set search_path='' as $function$
begin
 return query
 with batch as materialized (
 select p.id,p.source_id from public.players p where p.source='api-football'
 and p.source_kind='player' and p.birth_date is null and (p_after is null or p.id>p_after)
 order by p.id limit least(5000,greatest(1,coalesce(p_limit,5000)))
 ), dates as (
 select b.id,case when d.payload->'player'->'birth'->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 and pg_input_is_valid(d.payload->'player'->'birth'->>'date','date')
 then case when (d.payload->'player'->'birth'->>'date')::date>='1880-01-01'::date
 and (d.payload->'player'->'birth'->>'date')::date<current_date
 then (d.payload->'player'->'birth'->>'date')::date end end as birth_date
 from batch b join public.api_football_data d on d.kind='player_profile' and d.ref=b.source_id
 ), changed as (
 update public.players p set birth_date=d.birth_date from dates d
 where p.id=d.id and p.birth_date is null and d.birth_date is not null returning p.id
 )
 select (select count(*)::integer from batch),
 (select b.id from batch b order by b.id desc limit 1),(select count(*)::integer from changed);
end $function$;
revoke all on function public.backfill_football_birth_dates(uuid,integer) from public,anon,authenticated;
grant execute on function public.backfill_football_birth_dates(uuid,integer) to service_role;
