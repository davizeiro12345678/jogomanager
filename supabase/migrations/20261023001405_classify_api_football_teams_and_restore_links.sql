set lock_timeout='2s';
set statement_timeout='60s';
-- API-Football contains football records. Older materializers omitted sport,
-- so the generic Unknown default disabled every downstream team link.
create or replace function public.sportsdb_link_local_club()
returns trigger language plpgsql set search_path='' as $function$
declare local_competition text; verified_club text; provider_club text;
begin
 if NEW.sport='Soccer' then
  select l.club_id into verified_club from public.club_catalog_links l where l.source_team_id=NEW.source_id;
  if found then NEW.local_club_id:=verified_club; return NEW; end if;
  if NEW.source_id like 'af:%' then
   select case when count(*)=1 then min(c.id) end into provider_club from public.clubs c
    where c.data_source='api-football' and c.source_id=substring(NEW.source_id from 4);
   if provider_club is not null then NEW.local_club_id:=provider_club; return NEW; end if;
  end if;
 end if;
 if TG_OP='UPDATE' and NEW.sport is not distinct from OLD.sport
   and NEW.league_source_id is not distinct from OLD.league_source_id
   and NEW.name is not distinct from OLD.name and NEW.local_club_id is null then
  NEW.local_club_id:=OLD.local_club_id;
 elsif NEW.sport='Soccer' and NEW.league_source_id is not null then
  select l.local_competition_id into local_competition from public.official_leagues l
   where l.source_id=NEW.league_source_id and l.sport='Soccer';
  NEW.local_club_id:=case when local_competition is null then null
   else public.sportsdb_resolve_local_club(local_competition,NEW.name) end;
 else NEW.local_club_id:=null;
 end if;
 return NEW;
end $function$;

update public.official_teams t set sport='Soccer'
where t.source_id like 'af:%' and t.sport='Unknown'
and exists(select 1 from public.clubs c where c.data_source='api-football' and c.source_id=substring(t.source_id from 4));
