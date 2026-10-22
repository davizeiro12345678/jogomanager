-- Staged for Twilio Verify custom-code transport; not an enabled Supabase Auth hook.
-- The Send SMS HTTP hook does not provide a trusted originating client IP.
-- The second HMAC is deliberately fixed by the server, causing a conservative
-- 15 messages/hour GLOBAL budget, shared by SMS and WhatsApp, instead of
-- falsely claiming to enforce an IP limit.
create or replace function public.jm_consume_sms_hook_budget(
  p_phone_hmac text, p_global_hmac text, p_channel text
)
returns table(allowed boolean, retry_after_seconds integer, reason text)
language sql security invoker
set search_path = pg_catalog
as $$
  select b.allowed, b.retry_after_seconds, b.reason
  from auth_safety.consume_phone_otp_budget(p_phone_hmac,p_global_hmac,p_channel) as b;
$$;
revoke all on function public.jm_consume_sms_hook_budget(text,text,text)
from public, anon, authenticated;
grant execute on function public.jm_consume_sms_hook_budget(text,text,text)
to service_role;
