set lock_timeout='2s';
set statement_timeout='60s';
-- Only public venue fields are projected; provider archives remain private.
create or replace function public.enrich_football_venues(p_venues jsonb)
returns integer language plpgsql set search_path='' as $function$
declare changed integer;
begin
 if p_venues is null or jsonb_typeof(p_venues)<>'array' or jsonb_array_length(p_venues)>250 then
  raise exception 'Venue batch must contain at most 250 records' using errcode='22023';
 end if;
 with supplied as materialized (
 select distinct on(id) 'af:'||id as source_id,left(name,160) name,
 case when length(city) between 1 and 160 then city end city,
 case when length(country) between 1 and 120 then country end country,
 case when capacity ~ '^[0-9]{1,6}$' then case when capacity::integer between 1 and 500000 then capacity::integer end end capacity,
 case when image like 'https://%' and length(image)<=2048 then image end photo_url
 from jsonb_to_recordset(p_venues) as x(id text,team_id text,name text,city text,country text,capacity text,image text)
 where id ~ '^[1-9][0-9]{0,11}$' and length(trim(name)) between 1 and 160
 order by id
 )
 insert into public.official_venues as current(source_id,name,city,country,capacity,photo_url,updated_at)
 select source_id,name,city,country,capacity,photo_url,now() from supplied
 on conflict(source_id) do update set
 city=coalesce(current.city,excluded.city),country=coalesce(current.country,excluded.country),
 capacity=coalesce(current.capacity,excluded.capacity),photo_url=coalesce(current.photo_url,excluded.photo_url),
 updated_at=now()
 where (current.city is null and excluded.city is not null) or (current.country is null and excluded.country is not null)
 or (current.capacity is null and excluded.capacity is not null) or (current.photo_url is null and excluded.photo_url is not null);
 get diagnostics changed=row_count;
 with mappings as (
 select distinct on(team_id) 'af:'||team_id as team_id,'af:'||id as venue_id
 from jsonb_to_recordset(p_venues) as x(id text,team_id text)
 where id ~ '^[1-9][0-9]{0,11}$' and team_id ~ '^[1-9][0-9]{0,11}$'
 order by team_id
 )
 update public.official_teams t set venue_source_id=m.venue_id from mappings m
 where t.source_id=m.team_id and t.sport='Soccer' and t.venue_source_id is null
 and exists(select 1 from public.official_venues v where v.source_id=m.venue_id);
 return changed;
end $function$;
revoke all on function public.enrich_football_venues(jsonb) from public,anon,authenticated;
grant execute on function public.enrich_football_venues(jsonb) to service_role;

create or replace function public.backfill_existing_football_venues(p_after text default null,p_limit integer default 500)
returns table(processed integer,last_id text,materialized integer)
language plpgsql set search_path='' as $function$
declare records jsonb; slice jsonb; position integer; changed integer:=0; visited integer; cursor_value text;
begin
 with batch as materialized (
 select t.source_id from public.official_teams t where t.sport='Soccer' and t.source_id like 'af:%'
 and (p_after is null or t.source_id>p_after) order by t.source_id limit least(1000,greatest(1,coalesce(p_limit,500)))
 ), payloads as (
 select b.source_id,d.payload from batch b
 left join lateral (
 select a.payload from public.api_football_data a where a.kind='team'
 and a.ref>=substring(b.source_id from 4)||':' and a.ref<substring(b.source_id from 4)||';'
 order by a.updated_at desc,a.ref desc limit 1
 ) d on true
 )
 select count(*)::integer,max(source_id),coalesce(jsonb_agg(
 (payload->'venue')||jsonb_build_object('team_id',substring(source_id from 4),'country',payload->'team'->>'country')
 ) filter(where jsonb_typeof(payload->'venue')='object'),'[]'::jsonb)
 into visited,cursor_value,records from payloads;
 position:=0;
 while position<jsonb_array_length(records) loop
  select jsonb_agg(value) into slice from jsonb_array_elements(records) with ordinality x(value,index)
  where index>position and index<=position+250;
  changed:=changed+public.enrich_football_venues(slice);
  position:=position+250;
 end loop;
 return query select visited,cursor_value,changed;
end $function$;
revoke all on function public.backfill_existing_football_venues(text,integer) from public,anon,authenticated;
grant execute on function public.backfill_existing_football_venues(text,integer) to service_role;
