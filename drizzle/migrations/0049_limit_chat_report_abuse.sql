CREATE OR REPLACE FUNCTION public.validate_chat_report() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $function$
DECLARE target_user uuid; target_hidden boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.reporter_id::text, 411));
  SELECT user_id, hidden INTO target_user, target_hidden FROM public.chat_messages WHERE id = NEW.message_id;
  IF target_user IS NULL OR target_hidden OR target_user = NEW.reporter_id THEN
    RAISE EXCEPTION 'report_target_invalid' USING ERRCODE = '23514';
  END IF;
  IF char_length(btrim(NEW.reason)) NOT BETWEEN 3 AND 200 THEN
    RAISE EXCEPTION 'report_reason_invalid' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chat_reports WHERE reporter_id = NEW.reporter_id AND message_id = NEW.message_id) THEN RETURN NEW; END IF;
  IF (SELECT count(*) FROM public.chat_reports WHERE reporter_id = NEW.reporter_id AND created_at >= now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'report_rate_limited' USING ERRCODE = '23514';
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.validate_chat_report() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_chat_report_before_insert BEFORE INSERT ON public.chat_reports FOR EACH ROW EXECUTE FUNCTION public.validate_chat_report();
CREATE INDEX IF NOT EXISTS chat_reports_reporter_created_idx ON public.chat_reports(reporter_id, created_at DESC);
COMMENT ON FUNCTION public.validate_chat_report() IS 'Validate report target and bound new reports to ten per reporter per hour; serialize concurrent reports without trusting client timestamps.';