CREATE TABLE public.chat_infractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('profanity','link','contact','shouting','repeated')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chat_infractions TO authenticated;
GRANT ALL ON public.chat_infractions TO service_role;
ALTER TABLE public.chat_infractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own chat infractions" ON public.chat_infractions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX chat_infractions_user_time_idx ON public.chat_infractions (user_id, created_at DESC);
COMMENT ON TABLE public.chat_infractions IS 'Blocked chat messages per user; written only by the server, drives progressive mutes.';