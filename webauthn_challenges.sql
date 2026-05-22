-- Table for storing WebAuthn challenges server-side
-- Challenges must not be accepted from the client to prevent replay attacks

CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  challenge text NOT NULL,
  type text NOT NULL CHECK (type IN ('registration', 'authentication')),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, type)
);

-- Auto-expire old challenges (optional cleanup)
-- Challenges older than 5 minutes should be considered invalid
