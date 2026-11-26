-- Forward-only, OFF-by-default server-side matchmaking.
-- Nothing here alters existing rooms or competitive ratings; no browser grants.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE SCHEMA IF NOT EXISTS matchmaking_private;
REVOKE ALL ON SCHEMA matchmaking_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS matchmaking_private.ratings (
  user_id uuid PRIMARY KEY,
  rating integer NOT NULL DEFAULT 1400 CHECK (rating BETWEEN 0 AND 5000),
  games_played integer NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS matchmaking_private.blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE TABLE IF NOT EXISTS matchmaking_private.pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id uuid NOT NULL,
  away_id uuid NOT NULL,
  home_club text NOT NULL,
  away_club text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('casual', 'ranked')),
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'committed', 'expired')),
  room_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '60 seconds',
  CHECK (home_id <> away_id),
  CHECK (length(home_club) BETWEEN 1 AND 80),
  CHECK (length(away_club) BETWEEN 1 AND 80)
);
CREATE TABLE IF NOT EXISTS matchmaking_private.queue (
  user_id uuid PRIMARY KEY,
  club_id text NOT NULL CHECK (length(club_id) BETWEEN 1 AND 80),
  mode text NOT NULL CHECK (mode IN ('casual', 'ranked')),
  region text NOT NULL CHECK (region IN ('sa', 'na', 'eu', 'apac')),
  rating integer NOT NULL CHECK (rating BETWEEN 0 AND 5000),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'reserved')),
  reservation_id uuid REFERENCES matchmaking_private.pairs(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '5 minutes',
  CHECK ((status = 'waiting' AND reservation_id IS NULL)
      OR (status = 'reserved' AND reservation_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS matchmaking_queue_due_idx
  ON matchmaking_private.queue(status, joined_at, user_id);
CREATE INDEX IF NOT EXISTS matchmaking_pairs_recent_idx
  ON matchmaking_private.pairs(created_at DESC, home_id, away_id)
  WHERE status = 'committed';
CREATE INDEX IF NOT EXISTS matchmaking_pairs_lease_idx
  ON matchmaking_private.pairs(expires_at) WHERE status = 'reserved';

ALTER TABLE matchmaking_private.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_private.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_private.pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_private.queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA matchmaking_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA matchmaking_private FROM PUBLIC, anon, authenticated;

-- The caller is server-verified; browser-provided rating, queue timestamp,
-- identities of candidates and pair IDs are never accepted.
CREATE OR REPLACE FUNCTION public.match_queue_join(
  p_user uuid, p_club text, p_mode text, p_region text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_existing matchmaking_private.queue%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_rating integer;
BEGIN
  IF p_user IS NULL OR p_club IS NULL OR length(p_club) NOT BETWEEN 1 AND 80
     OR p_mode IS NULL OR p_mode NOT IN ('casual','ranked')
     OR p_region IS NULL OR p_region NOT IN ('sa','na','eu','apac')
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user)
  THEN RAISE EXCEPTION 'match_queue_invalid_admission' USING ERRCODE='22023'; END IF;

  -- One serialized queue transition per account, including active reservations.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 1964));
  SELECT * INTO v_existing FROM matchmaking_private.queue WHERE user_id=p_user FOR UPDATE;
  IF FOUND AND v_existing.status='reserved' AND v_existing.expires_at>v_now
  THEN RETURN jsonb_build_object('status','reserved'); END IF;

  INSERT INTO matchmaking_private.ratings(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
  SELECT rating INTO STRICT v_rating FROM matchmaking_private.ratings WHERE user_id=p_user;
  INSERT INTO matchmaking_private.queue(
    user_id,club_id,mode,region,rating,status,reservation_id,joined_at,expires_at
  ) VALUES(p_user,p_club,p_mode,p_region,v_rating,'waiting',NULL,v_now,v_now+interval '5 minutes')
  ON CONFLICT(user_id) DO UPDATE SET
    club_id=EXCLUDED.club_id, mode=EXCLUDED.mode, region=EXCLUDED.region,
    rating=EXCLUDED.rating, status='waiting', reservation_id=NULL,
    joined_at=CASE
      WHEN matchmaking_private.queue.status='waiting'
       AND matchmaking_private.queue.expires_at>v_now
       AND matchmaking_private.queue.mode=p_mode
       AND matchmaking_private.queue.region=p_region
       AND matchmaking_private.queue.club_id=p_club
      THEN matchmaking_private.queue.joined_at ELSE v_now END,
    expires_at=v_now+interval '5 minutes';
  RETURN jsonb_build_object('status','waiting','rating',v_rating);
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_queue_leave(p_user uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
BEGIN
  IF p_user IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 1964));
  DELETE FROM matchmaking_private.queue WHERE user_id=p_user AND status='waiting';
  RETURN FOUND;
END;
$function$;

-- A single PostgreSQL transaction owns reservation pairing. Advisory lock
-- bounds conflicting workers; each candidate row is also locked. No client
-- can supply a pair, rating or opponent. Ranking tolerances mirror policy v1.
CREATE OR REPLACE FUNCTION public.match_queue_claim()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_home matchmaking_private.queue%ROWTYPE;
  v_away matchmaking_private.queue%ROWTYPE;
  v_home_id uuid;
  v_away_id uuid;
  v_count integer;
  v_pair uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(772913552);
  UPDATE matchmaking_private.pairs SET status='expired'
   WHERE status='reserved' AND expires_at<=v_now;
  DELETE FROM matchmaking_private.queue WHERE expires_at<=v_now;
  SELECT a.user_id, b.user_id INTO v_home_id, v_away_id
    FROM matchmaking_private.queue a
    JOIN matchmaking_private.queue b
      ON a.user_id<>b.user_id
     AND a.mode=b.mode
     AND (a.joined_at<b.joined_at OR (a.joined_at=b.joined_at AND a.user_id<b.user_id))
    WHERE a.status='waiting' AND b.status='waiting'
      AND a.expires_at>v_now AND b.expires_at>v_now
      AND (a.region=b.region OR
        least(extract(epoch FROM (v_now-a.joined_at)),
              extract(epoch FROM (v_now-b.joined_at))) >= 90)
      AND (a.mode='casual' OR abs(a.rating-b.rating) <=
        least(450, 80 +
          floor(least(extract(epoch FROM (v_now-a.joined_at)),
                      extract(epoch FROM (v_now-b.joined_at)))/10)::integer * 20))
      AND NOT EXISTS (
        SELECT 1 FROM matchmaking_private.blocks blk
        WHERE (blk.blocker_id=a.user_id AND blk.blocked_id=b.user_id)
           OR (blk.blocker_id=b.user_id AND blk.blocked_id=a.user_id))
      AND NOT EXISTS (
        SELECT 1 FROM matchmaking_private.pairs prev
        WHERE prev.status='committed'
          AND prev.created_at>v_now-interval '120 seconds'
          AND ((prev.home_id=a.user_id AND prev.away_id=b.user_id)
            OR (prev.home_id=b.user_id AND prev.away_id=a.user_id)))
    ORDER BY a.joined_at, CASE WHEN a.region=b.region THEN 0 ELSE 1 END,
             abs(a.rating-b.rating), b.joined_at, b.user_id
    LIMIT 1 FOR UPDATE OF a,b SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO STRICT v_home FROM matchmaking_private.queue WHERE user_id=v_home_id;
  SELECT * INTO STRICT v_away FROM matchmaking_private.queue WHERE user_id=v_away_id;

  INSERT INTO matchmaking_private.pairs(home_id,away_id,home_club,away_club,mode,created_at,expires_at)
  VALUES (v_home.user_id,v_away.user_id,v_home.club_id,v_away.club_id,v_home.mode,
          v_now,v_now+interval '60 seconds') RETURNING id INTO v_pair;
  UPDATE matchmaking_private.queue SET
    status='reserved', reservation_id=v_pair, expires_at=v_now+interval '60 seconds'
    WHERE user_id IN (v_home.user_id,v_away.user_id) AND status='waiting';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count<>2 THEN RAISE EXCEPTION 'match_queue_reservation_failed'; END IF;
  RETURN jsonb_build_object('status','reserved','pairId',v_pair,'homeId',v_home.user_id,
    'awayId',v_away.user_id,'homeClub',v_home.club_id,'awayClub',v_away.club_id,
    'mode',v_home.mode,'region',v_home.region,'ratingGap',abs(v_home.rating-v_away.rating));
END;
$function$;

-- A room becomes official only when the existing server-created match room
-- agrees on both accounts and both selected clubs. This does not invent a
-- client-authoritative score or write ranked MMR from an unverified outcome.
CREATE OR REPLACE FUNCTION public.match_queue_confirm(p_pair uuid,p_room uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_match matchmaking_private.pairs%ROWTYPE;
BEGIN
  IF p_pair IS NULL OR p_room IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(772913552);
  SELECT * INTO v_match FROM matchmaking_private.pairs WHERE id=p_pair FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_match.status='committed' THEN RETURN v_match.room_id=p_room; END IF;
  IF v_match.status<>'reserved' OR v_match.expires_at<=clock_timestamp() THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.match_rooms room
    WHERE room.id=p_room AND room.server_seeded IS TRUE AND room.status IN ('ready','live')
      AND room.host_id=v_match.home_id AND room.guest_id=v_match.away_id
      AND room.host_club=v_match.home_club AND room.guest_club=v_match.away_club
  ) THEN RETURN false; END IF;
  UPDATE matchmaking_private.pairs SET status='committed',room_id=p_room WHERE id=p_pair;
  DELETE FROM matchmaking_private.queue WHERE reservation_id=p_pair;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_queue_release(p_pair uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
BEGIN
  IF p_pair IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(772913552);
  UPDATE matchmaking_private.pairs SET status='expired'
    WHERE id=p_pair AND status='reserved';
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE matchmaking_private.queue SET status='waiting',reservation_id=NULL,
    expires_at=clock_timestamp()+interval '5 minutes'
    WHERE reservation_id=p_pair;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.match_queue_join(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.match_queue_leave(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.match_queue_claim() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.match_queue_confirm(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.match_queue_release(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.match_queue_join(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_queue_leave(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_queue_claim() TO service_role;
GRANT EXECUTE ON FUNCTION public.match_queue_confirm(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_queue_release(uuid) TO service_role;
COMMENT ON SCHEMA matchmaking_private IS
  'Server-only reserved pairing, not a live ranked release or authority for match results.';
COMMIT;
