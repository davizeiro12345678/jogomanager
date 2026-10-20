-- Emergency stop for the old publicly callable telemetry function.
-- The previous deploy used a service-role client and ignored RLS, so removing
-- service-role INSERT immediately prevents unverified data from being stored.
-- Authenticated own-account samples use the narrow RLS INSERT column grant.
REVOKE INSERT ON TABLE public.tech_telemetry FROM service_role;