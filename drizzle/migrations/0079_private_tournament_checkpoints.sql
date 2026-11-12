-- Off-by-default tournament persistence; no public tournament endpoint.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE matchmaking_private.tournament_checkpoints (
  id uuid PRIMARY KEY,
  organizer_id uuid NOT NULL REFERENCES auth.users(id),
  region text NOT NULL CHECK(region IN ('sa','na','eu','apac')),
  revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
  status text NOT NULL DEFAULT 'live' CHECK(status IN ('live','completed')),
  checkpoint jsonb NOT NULL CHECK(jsonb_typeof(checkpoint)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX tournament_checkpoints_organizer_idx
  ON matchmaking_private.tournament_checkpoints(organizer_id,created_at DESC);
ALTER TABLE matchmaking_private.tournament_checkpoints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON matchmaking_private.tournament_checkpoints FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA matchmaking_private TO service_role;
GRANT SELECT,INSERT,UPDATE ON matchmaking_private.tournament_checkpoints TO service_role;

-- A server-only compare-and-swap, with exact-retry acknowledgement. Every
-- signed result inside checkpoint is still verified in TypeScript on restore.
CREATE FUNCTION public.save_private_tournament_checkpoint(
  p_id uuid,p_owner uuid,p_region text,p_revision bigint,
  p_checkpoint jsonb,p_completed boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE v matchmaking_private.tournament_checkpoints%ROWTYPE;
DECLARE v_status text;
BEGIN
  IF current_user<>'service_role' THEN
    RAISE EXCEPTION 'tournament_server_only' USING ERRCODE='42501';
  END IF;
  IF p_id IS NULL OR p_owner IS NULL OR p_region NOT IN ('sa','na','eu','apac')
    OR p_revision IS NULL OR p_revision<(-1) OR p_revision>=9223372036854775807
    OR p_completed IS NULL OR jsonb_typeof(p_checkpoint)<>'object'
    OR p_checkpoint->'version'<>'1'::jsonb
    OR jsonb_typeof(p_checkpoint->'entrants')<>'array'
    OR jsonb_typeof(p_checkpoint->'results')<>'array'
    OR jsonb_typeof(p_checkpoint->'pendingRooms')<>'array'
    OR jsonb_array_length(p_checkpoint->'entrants') NOT BETWEEN 2 AND 32
    OR jsonb_array_length(p_checkpoint->'results')>31
    OR jsonb_array_length(p_checkpoint->'pendingRooms')>16
    OR (p_checkpoint-'version'-'entrants'-'results'-'pendingRooms')<>'{}'::jsonb
    OR octet_length(p_checkpoint::text)>65536 THEN
    RAISE EXCEPTION 'invalid_tournament_checkpoint' USING ERRCODE='22023';
  END IF;
  v_status:=CASE WHEN p_completed THEN 'completed' ELSE 'live' END;
  SELECT * INTO v FROM matchmaking_private.tournament_checkpoints WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_revision<>-1 THEN RAISE EXCEPTION 'missing_tournament' USING ERRCODE='22023'; END IF;
    INSERT INTO matchmaking_private.tournament_checkpoints
      (id,organizer_id,region,status,checkpoint)
      VALUES(p_id,p_owner,p_region,v_status,p_checkpoint);
    RETURN jsonb_build_object('status','created','revision',0);
  END IF;
  IF v.organizer_id<>p_owner OR v.region<>p_region THEN
    RAISE EXCEPTION 'tournament_identity_conflict' USING ERRCODE='23505';
  END IF;
  IF v.checkpoint=p_checkpoint AND v.status=v_status AND
    (v.revision=p_revision+1 OR (p_revision=-1 AND v.revision=0)) THEN
    RETURN jsonb_build_object('status','already_saved','revision',v.revision);
  END IF;
  IF v.status='completed' THEN
    RAISE EXCEPTION 'tournament_finalized' USING ERRCODE='23514';
  END IF;
  IF v.revision<>p_revision THEN
    RAISE EXCEPTION 'tournament_revision_conflict' USING ERRCODE='40001';
  END IF;
  UPDATE matchmaking_private.tournament_checkpoints
    SET revision=revision+1,status=v_status,checkpoint=p_checkpoint,
      updated_at=clock_timestamp() WHERE id=p_id;
  RETURN jsonb_build_object('status','saved','revision',v.revision+1);
END;
$fn$;

CREATE FUNCTION public.get_private_tournament_checkpoint(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE v matchmaking_private.tournament_checkpoints%ROWTYPE;
BEGIN
  IF current_user<>'service_role' THEN
    RAISE EXCEPTION 'tournament_server_only' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v FROM matchmaking_private.tournament_checkpoints WHERE id=p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id',v.id,'organizerId',v.organizer_id,
    'region',v.region,'revision',v.revision,'status',v.status,'checkpoint',v.checkpoint);
END;
$fn$;

REVOKE ALL ON FUNCTION public.save_private_tournament_checkpoint(uuid,uuid,text,bigint,jsonb,boolean)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_private_tournament_checkpoint(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_private_tournament_checkpoint(uuid,uuid,text,bigint,jsonb,boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_private_tournament_checkpoint(uuid) TO service_role;
COMMIT;
