CREATE TABLE public.checkout_session_owners (
  session_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  environment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.checkout_session_owners TO service_role;
ALTER TABLE public.checkout_session_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend service only" ON public.checkout_session_owners FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX checkout_session_owners_user_idx ON public.checkout_session_owners(user_id);