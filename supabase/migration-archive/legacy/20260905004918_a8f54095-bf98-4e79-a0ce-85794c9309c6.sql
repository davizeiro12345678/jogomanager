DELETE FROM public.stadiums a USING public.stadiums b
WHERE a.name = b.name AND a.created_at > b.created_at;

ALTER TABLE public.stadiums ADD CONSTRAINT stadiums_name_key UNIQUE (name);