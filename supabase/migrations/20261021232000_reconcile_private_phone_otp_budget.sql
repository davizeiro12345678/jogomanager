-- Reconcile the private OTP budget originally applied directly to production.
-- Replay must create this function BEFORE the signed Twilio hook wrapper.
-- Idempotent against production: no existing SMS attempts are deleted.
create schema if not exists auth_safety;
revoke all on schema auth_safety from public, anon, authenticated;
grant usage on schema auth_safety to service_role;

create table if not exists auth_safety.phone_otp_attempts (
  id bigint generated always as identity primary key,
  phone_hmac text not null check (phone_hmac ~ '^[0-9a-f]{64}$'),
  ip_hmac text not null check (ip_hmac ~ '^[0-9a-f]{64}$'),
  channel text not null check (channel in ('sms','whatsapp')),
  requested_at timestamptz not null default now()
);
create index if not exists phone_otp_attempts_phone_time_idx
  on auth_safety.phone_otp_attempts (phone_hmac, requested_at desc);
create index if not exists phone_otp_attempts_ip_time_idx
  on auth_safety.phone_otp_attempts (ip_hmac, requested_at desc);
alter table auth_safety.phone_otp_attempts enable row level security;
revoke all on auth_safety.phone_otp_attempts from public, anon, authenticated;
grant select, insert, delete on auth_safety.phone_otp_attempts to service_role;

create or replace function auth_safety.consume_phone_otp_budget(
  p_phone_hmac text, p_ip_hmac text, p_channel text
) returns table(allowed boolean, retry_after_seconds integer, reason text)
language plpgsql security invoker
set search_path = pg_catalog
as $function$
declare
  current_at timestamptz := clock_timestamp();
  last_phone_attempt timestamptz;
  phone_hour bigint := 0;
  phone_day bigint := 0;
  ip_hour bigint := 0;
  phone_lock bigint;
  ip_lock bigint;
begin
  if p_phone_hmac is null or p_phone_hmac !~ '^[0-9a-f]{64}$'
    or p_ip_hmac is null or p_ip_hmac !~ '^[0-9a-f]{64}$'
    or p_channel is null or p_channel not in ('sms', 'whatsapp') then
    return query select false, 0, 'invalid_input'::text;
    return;
  end if;
  -- Acquire locks consistently so parallel SMS/WhatsApp requests cannot race.
  phone_lock := hashtextextended('phone:' || p_phone_hmac, 420);
  ip_lock := hashtextextended('ip:' || p_ip_hmac, 420);
  perform pg_advisory_xact_lock(least(phone_lock, ip_lock));
  if phone_lock <> ip_lock then
    perform pg_advisory_xact_lock(greatest(phone_lock, ip_lock));
  end if;
  select max(requested_at),
         count(*) filter (where requested_at > current_at - interval '1 hour'),
         count(*) filter (where requested_at > current_at - interval '24 hours')
    into last_phone_attempt, phone_hour, phone_day
    from auth_safety.phone_otp_attempts
    where phone_hmac = p_phone_hmac and requested_at > current_at - interval '24 hours';
  select count(*) into ip_hour
    from auth_safety.phone_otp_attempts
    where ip_hmac = p_ip_hmac and requested_at > current_at - interval '1 hour';
  if last_phone_attempt is not null and current_at < last_phone_attempt + interval '60 seconds' then
    return query select false,
      greatest(1,ceil(extract(epoch from (last_phone_attempt + interval '60 seconds' - current_at)))::integer),
      'cooldown'::text;
    return;
  end if;
  if phone_hour >= 4 or ip_hour >= 15 then
    return query select false, 3600, 'hourly_limit'::text;
    return;
  end if;
  if phone_day >= 8 then
    return query select false, 86400, 'daily_limit'::text;
    return;
  end if;
  insert into auth_safety.phone_otp_attempts (phone_hmac, ip_hmac, channel, requested_at)
    values (p_phone_hmac, p_ip_hmac, p_channel, current_at);
  return query select true, 0, 'allowed'::text;
end;
$function$;
revoke all on function auth_safety.consume_phone_otp_budget(text,text,text) from public,anon,authenticated;
grant execute on function auth_safety.consume_phone_otp_budget(text,text,text) to service_role;
