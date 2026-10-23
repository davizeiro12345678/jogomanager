set lock_timeout='2s';
set statement_timeout='30s';
create unique index club_catalog_links_team_idx on public.club_catalog_links(source_team_id) where source_team_id is not null;

-- The old trigger recomputed every explicit API-Football link using a league
-- name resolver. A continental league could therefore erase a verified club.
create or replace function public.sportsdb_link_local_club()
returns trigger language plpgsql set search_path='' as $function$
declare local_competition text; verified_club text;
begin
 if NEW.sport='Soccer' then
  select l.club_id into verified_club from public.club_catalog_links l where l.source_team_id=NEW.source_id;
  if found then NEW.local_club_id:=verified_club; return NEW; end if;
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

update public.official_teams t set local_club_id=l.club_id from public.club_catalog_links l
 where t.source_id=l.source_team_id and t.local_club_id is distinct from l.club_id;
