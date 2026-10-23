set lock_timeout='2s';
set statement_timeout='120s';
-- Equality on a source ID must not depend on punctuation order in database collation.
create index api_football_team_profile_lookup_idx on public.api_football_data((split_part(ref,':',1)),updated_at desc,ref desc) where kind='team';
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
 and split_part(a.ref,':',1)=substring(b.source_id from 4)
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
