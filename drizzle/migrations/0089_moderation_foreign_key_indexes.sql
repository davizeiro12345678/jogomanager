-- Cover only the eight foreign keys flagged by the Supabase advisory.
-- Separate indexes keep FK checks bounded on parent deletes/updates.
-- No policy/grant changes, data rewrite, or exclusive schema migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE INDEX IF NOT EXISTS appeals_reviewer_id_fk_idx
  ON moderation_private.appeals (reviewer_id);
CREATE INDEX IF NOT EXISTS audit_actor_id_fk_idx
  ON moderation_private.audit (actor_id);
CREATE INDEX IF NOT EXISTS cases_reporter_id_fk_idx
  ON moderation_private.cases (reporter_id);
CREATE INDEX IF NOT EXISTS cases_reviewer_id_fk_idx
  ON moderation_private.cases (reviewer_id);
CREATE INDEX IF NOT EXISTS cases_room_id_fk_idx
  ON moderation_private.cases (room_id);
CREATE INDEX IF NOT EXISTS cases_subject_id_fk_idx
  ON moderation_private.cases (subject_id);
CREATE INDEX IF NOT EXISTS room_mutes_case_id_fk_idx
  ON moderation_private.room_mutes (case_id);
CREATE INDEX IF NOT EXISTS room_mutes_room_id_fk_idx
  ON moderation_private.room_mutes (room_id);
COMMIT;
