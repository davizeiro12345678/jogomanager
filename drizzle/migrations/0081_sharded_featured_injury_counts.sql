-- Fast, exact, 64-way sharded counters for 12 public featured injury leagues.
-- The source row-map and its three write triggers remain the source of truth.
-- 64 shards distribute simultaneous imports and keep public reads below 800 rows.
-- This migration holds an EXCLUSIVE METADATA lock on the *small projection* only,
-- never on the 15GB api_football_data source. Must finish within 12 seconds.
SET lock_timeout = '2500ms';
SET statement_timeout = '12000ms';

CREATE TABLE IF NOT EXISTS private_performance.featured_injury_count_shards (
  league_id integer NOT NULL CHECK (league_id = ANY (
    ARRAY[71,72,39,140,135,78,61,94,88,128,253,262]::integer[]
  )),
  shard smallint NOT NULL CHECK (shard BETWEEN 0 AND 63),
  injury_count bigint NOT NULL DEFAULT 0 CHECK (injury_count >= 0),
  PRIMARY KEY (league_id, shard)
);
ALTER TABLE private_performance.featured_injury_count_shards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_performance.featured_injury_count_shards
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private_performance.featured_injury_shard_delta(
  p_league integer, p_shard smallint, p_delta integer
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $adjust$
BEGIN
  IF p_delta = 1 THEN
    INSERT INTO private_performance.featured_injury_count_shards AS counter
      (league_id,shard,injury_count)
    VALUES (p_league,p_shard,1)
    ON CONFLICT (league_id,shard) DO UPDATE
       SET injury_count=counter.injury_count+1;
  ELSIF p_delta = -1 THEN
    UPDATE private_performance.featured_injury_count_shards
      SET injury_count=injury_count-1
    WHERE league_id=p_league AND shard=p_shard AND injury_count>0;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'injury counter inconsistency for league % shard %',p_league,p_shard;
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid injury counter delta' USING ERRCODE='22023';
  END IF;
END;
$adjust$;
REVOKE ALL ON FUNCTION private_performance.featured_injury_shard_delta(integer,smallint,integer)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private_performance.maintain_featured_injury_shards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $sharded$
DECLARE old_shard smallint; new_shard smallint;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_shard:=(pg_catalog.hashtextextended(OLD.ref,0) & 63)::smallint;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_shard:=(pg_catalog.hashtextextended(NEW.ref,0) & 63)::smallint;
  END IF;
  IF TG_OP='INSERT' THEN
    PERFORM private_performance.featured_injury_shard_delta(NEW.league_id,new_shard,1);
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN
    PERFORM private_performance.featured_injury_shard_delta(OLD.league_id,old_shard,-1);
    RETURN OLD;
  END IF;
  IF OLD.league_id=NEW.league_id AND old_shard=new_shard THEN
    RETURN NEW;
  END IF;
  -- Acquire counters in a stable key order for common single-row moves.
  IF (OLD.league_id,old_shard) < (NEW.league_id,new_shard) THEN
    PERFORM private_performance.featured_injury_shard_delta(OLD.league_id,old_shard,-1);
    PERFORM private_performance.featured_injury_shard_delta(NEW.league_id,new_shard,1);
  ELSE
    PERFORM private_performance.featured_injury_shard_delta(NEW.league_id,new_shard,1);
    PERFORM private_performance.featured_injury_shard_delta(OLD.league_id,old_shard,-1);
  END IF;
  RETURN NEW;
END;
$sharded$;
REVOKE ALL ON FUNCTION private_performance.maintain_featured_injury_shards()
  FROM PUBLIC,anon,authenticated,service_role;

-- CREATE TRIGGER blocks concurrent writes to the 109k-row *projection* until
-- this transaction seeds the 12*64 counters, preventing a read/write race.
DROP TRIGGER IF EXISTS featured_injury_shard_insert ON private_performance.featured_injury_rows;
DROP TRIGGER IF EXISTS featured_injury_shard_update ON private_performance.featured_injury_rows;
DROP TRIGGER IF EXISTS featured_injury_shard_delete ON private_performance.featured_injury_rows;
CREATE TRIGGER featured_injury_shard_insert
AFTER INSERT ON private_performance.featured_injury_rows
FOR EACH ROW EXECUTE FUNCTION private_performance.maintain_featured_injury_shards();
CREATE TRIGGER featured_injury_shard_update
AFTER UPDATE OF ref,league_id ON private_performance.featured_injury_rows
FOR EACH ROW EXECUTE FUNCTION private_performance.maintain_featured_injury_shards();
CREATE TRIGGER featured_injury_shard_delete
AFTER DELETE ON private_performance.featured_injury_rows
FOR EACH ROW EXECUTE FUNCTION private_performance.maintain_featured_injury_shards();

DELETE FROM private_performance.featured_injury_count_shards;
INSERT INTO private_performance.featured_injury_count_shards(league_id,shard,injury_count)
SELECT league_id,(pg_catalog.hashtextextended(ref,0) & 63)::smallint,
       count(*)::bigint
FROM private_performance.featured_injury_rows
GROUP BY league_id,(pg_catalog.hashtextextended(ref,0) & 63)::smallint;

CREATE OR REPLACE VIEW private_performance.featured_injury_counts_sharded AS
SELECT league_id,sum(injury_count)::bigint AS injury_count
FROM private_performance.featured_injury_count_shards GROUP BY league_id;
REVOKE ALL ON private_performance.featured_injury_counts_sharded FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private_performance TO service_role;
GRANT SELECT ON private_performance.featured_injury_counts_sharded TO service_role;

-- A missing or double-counted injury is a hard deployment failure.
DO $match$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT coalesce(a.league_id,b.league_id) AS league_id
      FROM private_performance.featured_injury_counts_live a
      FULL JOIN private_performance.featured_injury_counts_sharded b
        ON a.league_id=b.league_id
      WHERE coalesce(a.injury_count,0)<>coalesce(b.injury_count,0)
    ) mismatches
  ) THEN
    RAISE EXCEPTION 'Sharded injury counts do not match exact projected source';
  END IF;
END;
$match$;
RESET statement_timeout;
RESET lock_timeout;
