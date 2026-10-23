-- Reviewed additive upgrade. Raw events, player IDs and private saves are retained.
set lock_timeout = '2s';
set statement_timeout = '60s';

alter table public.api_football_import_progress drop constraint api_football_import_progress_phase_check;
alter table public.api_football_import_progress add constraint api_football_import_progress_phase_check check (phase in (
 'leagues','teams','squads','fixtures','standings','predictions','odds','stats',
 'countries','timezones','venues','coaches','injuries','teamstats','details',
 'playerprofiles','playerseasons','transfers','trophies','sidelined','topscorers',
 'topassists','topyellowcards','topredcards','fixtureevents','fixturelineups',
 'fixturestatistics','fixtureplayers'
));
insert into public.api_football_import_progress(phase,status,batch_size)
select phase,'paused',10 from unnest(array[
 'playerprofiles','playerseasons','transfers','trophies','sidelined','topscorers',
 'topassists','topyellowcards','topredcards','fixtureevents','fixturelineups',
 'fixturestatistics','fixtureplayers'
]) phase on conflict(phase) do nothing;

create index if not exists official_events_league_time_cursor_idx
 on public.official_events(league_source_id, starts_at desc, source_id);
create index if not exists players_api_import_cursor_idx
 on public.players(source_id) where source='api-football' and source_kind='player' and canonical_player_id is null;

create table public.official_event_aliases (
 source_id text primary key references public.official_events(source_id) on delete cascade,
 canonical_source_id text not null references public.official_events(source_id),
 reason text not null default 'identical-provider-fixture',
 reviewed_at timestamptz not null default now(),
 check(source_id <> canonical_source_id)
);
create index official_event_aliases_canonical_idx on public.official_event_aliases(canonical_source_id);
alter table public.official_event_aliases enable row level security;
revoke all on public.official_event_aliases from anon,authenticated;
grant select on public.official_event_aliases to anon,authenticated;
grant all on public.official_event_aliases to service_role;
create policy public_event_alias_read on public.official_event_aliases for select to anon,authenticated using(true);

-- Only exact copies in the measured 2026 season are eligible. Conflicting
-- scores, seasons, statuses and venues remain distinct for source review.
with duplicate_keys as (
 select league_source_id,season,home_team_source_id,away_team_source_id,starts_at,
        home_score,away_score,status,venue_source_id
 from public.official_events
 where starts_at >= '2026-01-01T00:00:00Z' and starts_at < '2027-01-01T00:00:00Z'
   and home_team_source_id is not null and away_team_source_id is not null
   and status in ('FT','AET','PEN','NS')
 group by league_source_id,season,home_team_source_id,away_team_source_id,starts_at,
          home_score,away_score,status,venue_source_id
 having count(*)>1
), ranked as (
 select e.source_id,first_value(e.source_id) over (
   partition by e.league_source_id,e.season,e.home_team_source_id,e.away_team_source_id,
    e.starts_at,e.home_score,e.away_score,e.status,e.venue_source_id,
    case when e.source_id like 'af:%' then 'af' else 'sportsdb' end
   order by (select count(*) from public.official_event_details d where d.event_source_id=e.source_id) desc,
     e.source_updated_at desc nulls last,e.updated_at desc,e.source_id
 ) canonical_source_id
 from public.official_events e join duplicate_keys k
 on e.league_source_id is not distinct from k.league_source_id and e.season is not distinct from k.season
 and e.home_team_source_id=k.home_team_source_id and e.away_team_source_id=k.away_team_source_id
 and e.starts_at=k.starts_at and e.home_score is not distinct from k.home_score
 and e.away_score is not distinct from k.away_score and e.status=k.status
 and e.venue_source_id is not distinct from k.venue_source_id
)
insert into public.official_event_aliases(source_id,canonical_source_id)
select source_id,canonical_source_id from ranked where source_id<>canonical_source_id;

create view public.official_events_catalog with(security_invoker=true) as
select e.* from public.official_events e where not exists (
 select 1 from public.official_event_aliases a
 join public.official_events c on c.source_id=a.canonical_source_id
 where a.source_id=e.source_id
 and c.league_source_id is not distinct from e.league_source_id
 and c.season is not distinct from e.season and c.starts_at=e.starts_at
 and c.home_team_source_id=e.home_team_source_id and c.away_team_source_id=e.away_team_source_id
 and c.home_score is not distinct from e.home_score and c.away_score is not distinct from e.away_score
 and c.status is not distinct from e.status and c.venue_source_id is not distinct from e.venue_source_id
);
create view public.players_catalog with(security_invoker=true) as
select * from public.players where source_kind='player' and canonical_player_id is null;
grant select on public.official_events_catalog,public.players_catalog to anon,authenticated,service_role;
comment on view public.official_events_catalog is 'Public canonical fixtures; raw records and conflicting provider data remain preserved.';
comment on view public.players_catalog is 'Playable people only; staff and reviewed identity aliases stay in the source table.';
