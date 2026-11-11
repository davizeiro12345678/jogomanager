-- Only a trusted server which has verified an HMAC receipt may invoke this
-- service-role-only RPC. Browsers cannot submit goals, ratings or rewards.
-- Ranking and official scoreboard commit together with a unique receipt.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE TABLE IF NOT EXISTS matchmaking_private.authoritative_results (
  room_id uuid PRIMARY KEY REFERENCES public.match_rooms(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL UNIQUE,
  command_hash text NOT NULL CHECK (command_hash ~ '^[a-f0-9]{64}$'),
  signature text NOT NULL CHECK (signature ~ '^[A-Za-z0-9_-]{43,44}$'),
  simulation_version text NOT NULL CHECK (simulation_version IN ('contact-1','contact-2')),
  closure_reason text NOT NULL
    CHECK (closure_reason IN ('completed','forfeit','abandoned','cancelled')),
  home_goals integer NOT NULL CHECK (home_goals BETWEEN 0 AND 99),
  away_goals integer NOT NULL CHECK (away_goals BETWEEN 0 AND 99),
  match_minute integer NOT NULL CHECK (match_minute BETWEEN 0 AND 130),
  ranking_status text NOT NULL
    CHECK (ranking_status IN ('unranked','applied','review')),
  rating_delta integer NOT NULL DEFAULT 0 CHECK (rating_delta BETWEEN -32 AND 32),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE matchmaking_private.authoritative_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON matchmaking_private.authoritative_results FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS matchmaking_results_recent_idx
  ON matchmaking_private.authoritative_results(created_at DESC);

CREATE OR REPLACE FUNCTION public.settle_authoritative_match(
  p_room uuid, p_receipt_id uuid, p_hash text, p_signature text,
  p_simulation_version text, p_closure_reason text,
  p_home_goals integer, p_away_goals integer, p_minute integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE
  v_room public.match_rooms%ROWTYPE;
  v_previous matchmaking_private.authoritative_results%ROWTYPE;
  v_pair matchmaking_private.pairs%ROWTYPE;
  v_home_rating integer;
  v_away_rating integer;
  v_delta integer := 0;
  v_outcome numeric;
  v_expected numeric;
  v_repeat_count integer;
  v_ranking text := 'unranked';
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_room IS NULL OR p_receipt_id IS NULL OR p_hash IS NULL OR
     p_hash !~ '^[a-f0-9]{64}$' OR p_signature IS NULL OR
     p_signature !~ '^[A-Za-z0-9_-]{43,44}$' OR
     p_simulation_version NOT IN ('contact-1','contact-2') OR
     p_closure_reason NOT IN ('completed','forfeit','abandoned','cancelled') OR
     p_home_goals IS NULL OR p_home_goals NOT BETWEEN 0 AND 99 OR
     p_away_goals IS NULL OR p_away_goals NOT BETWEEN 0 AND 99 OR
     p_minute IS NULL OR p_minute NOT BETWEEN 0 AND 130
  THEN RAISE EXCEPTION 'authoritative_receipt_invalid' USING ERRCODE='22023'; END IF;

  -- A unique room is the first lock. Concurrent retries for the same receipt
  -- cannot award Elo twice. A competing final result must not overwrite it.
  SELECT * INTO v_room FROM public.match_rooms WHERE id=p_room FOR UPDATE;
  IF NOT FOUND OR NOT v_room.server_seeded OR v_room.guest_id IS NULL
  THEN RAISE EXCEPTION 'authoritative_room_unavailable' USING ERRCODE='22023'; END IF;
  IF v_room.contact_physics_revision <>
    (CASE p_simulation_version WHEN 'contact-2' THEN 2 ELSE 1 END)
  THEN RAISE EXCEPTION 'authoritative_simulation_revision_mismatch' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_previous FROM matchmaking_private.authoritative_results
    WHERE room_id=p_room FOR UPDATE;
  IF FOUND THEN
    IF v_previous.receipt_id=p_receipt_id
      AND v_previous.command_hash=p_hash
      AND v_previous.signature=p_signature
      AND v_previous.home_goals=p_home_goals
      AND v_previous.away_goals=p_away_goals
      AND v_previous.match_minute=p_minute
      AND v_previous.simulation_version=p_simulation_version
      AND v_previous.closure_reason=p_closure_reason
    THEN RETURN jsonb_build_object(
      'status','already_settled','ranking',v_previous.ranking_status,
      'ratingDelta',v_previous.rating_delta
    ); END IF;
    RAISE EXCEPTION 'authoritative_receipt_conflict' USING ERRCODE='23505';
  END IF;
  IF v_room.status NOT IN ('live','settling') THEN
    RAISE EXCEPTION 'authoritative_room_not_live' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_pair FROM matchmaking_private.pairs
    WHERE room_id=p_room AND status='committed' FOR UPDATE;
  IF FOUND AND
    (v_pair.home_id<>v_room.host_id OR v_pair.away_id<>v_room.guest_id
       OR v_pair.home_club<>v_room.host_club
       OR v_pair.away_club<>v_room.guest_club)
  THEN RAISE EXCEPTION 'ranked_pair_tampering' USING ERRCODE='23514'; END IF;

  IF FOUND AND v_pair.mode='ranked' AND p_closure_reason<>'cancelled' THEN
    -- Do not award dozens of Elo adjustments from the same opponent pairing.
    SELECT count(*) INTO v_repeat_count
    FROM matchmaking_private.authoritative_results result
    JOIN matchmaking_private.pairs pair ON pair.room_id=result.room_id
    WHERE pair.mode='ranked'
      AND result.created_at>=v_now-interval '1 day'
      AND (
        (pair.home_id=v_pair.home_id AND pair.away_id=v_pair.away_id)
        OR (pair.home_id=v_pair.away_id AND pair.away_id=v_pair.home_id)
      );
    IF v_repeat_count >= 3 THEN
      v_ranking := 'review';
    ELSE
      -- Stable lock order across matches avoids ratings deadlocks.
      PERFORM 1 FROM matchmaking_private.ratings
        WHERE user_id IN (v_pair.home_id,v_pair.away_id)
        ORDER BY user_id FOR UPDATE;
      SELECT rating INTO v_home_rating FROM matchmaking_private.ratings
        WHERE user_id=v_pair.home_id;
      SELECT rating INTO v_away_rating FROM matchmaking_private.ratings
        WHERE user_id=v_pair.away_id;
      IF v_home_rating IS NULL OR v_away_rating IS NULL THEN
        RAISE EXCEPTION 'ranked_rating_missing' USING ERRCODE='22023';
      END IF;
      v_outcome := CASE WHEN p_home_goals>p_away_goals THEN 1::numeric
        WHEN p_home_goals<p_away_goals THEN 0::numeric ELSE 0.5::numeric END;
      v_expected := 1::numeric / (1 + power(10::numeric,
        (v_away_rating - v_home_rating)::numeric / 400));
      v_delta := round(32 * (v_outcome - v_expected))::integer;
      UPDATE matchmaking_private.ratings SET
        rating=greatest(0,least(5000,rating+v_delta)),
        games_played=games_played+1,updated_at=v_now WHERE user_id=v_pair.home_id;
      UPDATE matchmaking_private.ratings SET
        rating=greatest(0,least(5000,rating-v_delta)),
        games_played=games_played+1,updated_at=v_now WHERE user_id=v_pair.away_id;
      v_ranking := 'applied';
    END IF;
  END IF;

  INSERT INTO matchmaking_private.authoritative_results(
    room_id,receipt_id,command_hash,signature,simulation_version,closure_reason,
    home_goals,away_goals,match_minute,ranking_status,rating_delta,created_at
  ) VALUES (
    p_room,p_receipt_id,p_hash,p_signature,p_simulation_version,p_closure_reason,
    p_home_goals,p_away_goals,p_minute,v_ranking,v_delta,v_now
  );
  UPDATE public.match_rooms SET
    status='done',minute=p_minute,seed='',updated_at=v_now,
    state=jsonb_build_object('hg',p_home_goals,'ag',p_away_goals,'authority','signed-v1')
  WHERE id=p_room AND status IN ('live','settling');
  IF NOT FOUND THEN RAISE EXCEPTION 'authoritative_room_settlement_race'; END IF;
  DELETE FROM public.match_room_secrets WHERE room_id=p_room;

  RETURN jsonb_build_object(
    'status','settled','ranking',v_ranking,'ratingDelta',v_delta
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_authoritative_match(
  uuid,uuid,text,text,text,text,integer,integer,integer
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_authoritative_match(
  uuid,uuid,text,text,text,text,integer,integer,integer
) TO service_role;
COMMENT ON FUNCTION public.settle_authoritative_match(
  uuid,uuid,text,text,text,text,integer,integer,integer
) IS 'Trusted server only. HMAC verified before RPC; unique receipt, scoreboard, private seed removal and Elo in one transaction.';
COMMIT;
