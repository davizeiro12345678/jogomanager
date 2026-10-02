-- Live, transactional regression check. Every verification row is rolled back.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE first_id uuid; total bigint; BEGIN
  INSERT INTO public.official_players(source_id,team_source_id,name,birth_date,position)
    VALUES ('verification-player-one','verification-team','Atleta de Verificação','2001-01-02','Forward'),
           ('verification-player-two','verification-team','Atleta de Verificação','2001-01-02','Forward');
  SELECT count(*) INTO total FROM public.official_players WHERE source_id LIKE 'verification-player-%';
  IF total<>1 THEN RAISE EXCEPTION 'Duplicate official registration was not merged'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.sportsdb_player_aliases WHERE alias_source_id='verification-player-two'
    AND canonical_source_id='verification-player-one' AND original_record->>'name'='Atleta de Verificação') THEN
    RAISE EXCEPTION 'Source alias or original record was lost'; END IF;

  INSERT INTO public.official_players(source_id,team_source_id,name,birth_date,position)
    VALUES ('verification-player-one','verification-team','Atleta de Verificação','2001-01-02','Forward'),
           ('verification-player-two','verification-team','Atleta de Verificação','2001-01-02','Forward')
    ON CONFLICT(source_id) DO UPDATE SET position=excluded.position;
  SELECT count(*) INTO total FROM public.official_players WHERE source_id LIKE 'verification-player-%';
  IF total<>1 THEN RAISE EXCEPTION 'Reimport recreated a duplicate'; END IF;

  INSERT INTO public.official_players(source_id,team_source_id,name,birth_date,position)
    VALUES ('verification-player-other-birth','verification-team','Atleta de Verificação','2002-01-02','Forward'),
           ('verification-player-other-team','verification-other-team','Atleta de Verificação','2001-01-02','Forward'),
           ('verification-player-no-birth','verification-team','Atleta de Verificação',NULL,'Forward');
  SELECT count(*) INTO total FROM public.official_players WHERE source_id LIKE 'verification-player-%';
  IF total<>4 THEN RAISE EXCEPTION 'Different or unverified athletes were incorrectly merged'; END IF;

  INSERT INTO public.players(club_id,name,position,age,overall,source,source_id)
    VALUES('flu','Jogador personalizado','MF',24,71,'verification-provider','verification-stable-id') RETURNING id INTO first_id;
  INSERT INTO public.players(club_id,name,position,age,overall,source,source_id)
    VALUES('flu','Nome vindo da reimportação','MF',24,99,'verification-provider','verification-stable-id')
    ON CONFLICT(source,source_id) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM public.players WHERE id=first_id AND name='Jogador personalizado' AND overall=71) THEN
    RAISE EXCEPTION 'Reimport overwrote customized player fields'; END IF;
  SELECT count(*) INTO total FROM public.players WHERE source='verification-provider' AND source_id='verification-stable-id';
  IF total<>1 THEN RAISE EXCEPTION 'Stable game source identity was duplicated'; END IF;
END $$;
ROLLBACK;
SELECT 'Player identity checks passed; verification changes rolled back' AS verification;
