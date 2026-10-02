-- Run after the migration and the sportsdb-bridge Edge Function deployment.
-- No API credentials are stored in this file or in the scheduler command.
SELECT cron.schedule('sportsdb-supabase-import', '* * * * *', $job$
  SELECT net.http_post(
    url := 'https://lguqnwvsfeefxamzeyos.supabase.co/functions/v1/sportsdb-bridge',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='sportsdb_bridge_scheduler_token')),
    body := '{}'::jsonb, timeout_milliseconds := 60000
  ) FROM public.sportsdb_bridge_control
  WHERE enabled AND status<>'complete' AND (lease_until IS NULL OR lease_until<now());
$job$);

SELECT net.http_post(
  url := 'https://lguqnwvsfeefxamzeyos.supabase.co/functions/v1/sportsdb-bridge',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='sportsdb_bridge_scheduler_token')),
  body := '{}'::jsonb, timeout_milliseconds := 60000
);
