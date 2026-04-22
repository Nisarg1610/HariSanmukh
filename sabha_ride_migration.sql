CREATE TABLE public.sabha_ride_status (
  household_id uuid PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
  is_enabled boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.sabha_ride_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  vote text NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(household_id, member_id)
);
