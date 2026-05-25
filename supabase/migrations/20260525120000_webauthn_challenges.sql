CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  type text NOT NULL CHECK (type IN ('registration', 'authentication')),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, type)
);

CREATE INDEX IF NOT EXISTS webauthn_challenges_created_at_idx
  ON public.webauthn_challenges (created_at);
