UPDATE public.clubs c SET competition_id = l.local_competition_id
FROM public.official_teams t JOIN public.official_leagues l ON l.source_id = t.league_source_id
WHERE t.local_club_id = c.id AND c.competition_id IS NULL AND l.local_competition_id IS NOT NULL;

UPDATE public.competitions comp SET club_count = LEAST(32767, sub.n)
FROM (SELECT competition_id, count(*) n FROM public.clubs WHERE competition_id IS NOT NULL GROUP BY competition_id) sub
WHERE sub.competition_id = comp.id;