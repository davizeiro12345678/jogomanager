BEGIN;

DO $$
DECLARE
  v_ref text := '__jm_featured_injury_incremental_contract__';
  v_before_71 bigint;
  v_before_72 bigint;
  v_after_71 bigint;
  v_after_72 bigint;
BEGIN
  SELECT coalesce(injury_count, 0) INTO v_before_71
  FROM private_performance.featured_injury_counts_live WHERE league_id = 71;
  SELECT coalesce(injury_count, 0) INTO v_before_72
  FROM private_performance.featured_injury_counts_live WHERE league_id = 72;

  INSERT INTO public.api_football_data(kind, ref, payload, updated_at)
  VALUES ('injury', v_ref, jsonb_build_object('league', jsonb_build_object('id', '71')), now());

  ASSERT EXISTS (
    SELECT 1 FROM private_performance.featured_injury_rows
    WHERE ref = v_ref AND league_id = 71
  ), 'insert trigger must index a featured injury row';

  SELECT injury_count INTO v_after_71
  FROM private_performance.featured_injury_counts_live WHERE league_id = 71;
  ASSERT v_after_71 = v_before_71 + 1, 'insert must increment the live count';

  UPDATE public.api_football_data
  SET payload = jsonb_build_object('league', jsonb_build_object('id', '72')),
      updated_at = now()
  WHERE kind = 'injury' AND ref = v_ref;

  ASSERT EXISTS (
    SELECT 1 FROM private_performance.featured_injury_rows
    WHERE ref = v_ref AND league_id = 72
  ), 'update trigger must move an injury between featured leagues';

  SELECT injury_count INTO v_after_71
  FROM private_performance.featured_injury_counts_live WHERE league_id = 71;
  SELECT injury_count INTO v_after_72
  FROM private_performance.featured_injury_counts_live WHERE league_id = 72;
  ASSERT v_after_71 = v_before_71, 'league 71 count must be decremented after a move';
  ASSERT v_after_72 = v_before_72 + 1, 'league 72 count must be incremented after a move';

  DELETE FROM public.api_football_data WHERE kind = 'injury' AND ref = v_ref;
  ASSERT NOT EXISTS (
    SELECT 1 FROM private_performance.featured_injury_rows WHERE ref = v_ref
  ), 'delete trigger must remove the indexed injury row';

  SELECT coalesce(injury_count, 0) INTO v_after_72
  FROM private_performance.featured_injury_counts_live WHERE league_id = 72;
  ASSERT v_after_72 = v_before_72, 'delete must restore the original live count';
END;
$$;

ROLLBACK;
