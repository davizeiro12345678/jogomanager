SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $fix$
DECLARE
  original text;
  anchor text := $anchor$   EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE %s FOR UPDATE',target,predicate) INTO previous;$anchor$;
  replacement text := $replacement$   -- Preserve the original advisory-lock identity above. Build an indexable,
   -- null-equivalent lookup separately; never replace text inside quoted values.
   SELECT string_agg(CASE WHEN rowdata->>k IS NULL THEN format('%I IS NULL',k) ELSE format('%I = %L',k,rowdata->>k) END,' AND ' ORDER BY k)
   INTO predicate FROM unnest(keys) k;
   EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE %s FOR UPDATE',target,predicate) INTO previous;$replacement$;
BEGIN
  SELECT pg_get_functiondef('public.football_queue_finish(text,uuid,jsonb,jsonb,integer,integer,integer)'::regprocedure) INTO original;
  IF md5(original) <> 'f92f298fd9b6fd7bdc9ab5a82362f57e' THEN
    RAISE EXCEPTION 'Function changed since review; refusing to overwrite';
  END IF;
  IF (length(original)-length(replace(original,anchor,''))) <> length(anchor) THEN
    RAISE EXCEPTION 'Expected exactly one reviewed lookup';
  END IF;
  EXECUTE replace(original,anchor,replacement);
END
$fix$;
