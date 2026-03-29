CREATE TABLE public.laundry_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  member_id uuid NOT NULL,
  washer_started_at timestamp with time zone,
  washer_completed_at timestamp with time zone,
  dryer_started_at timestamp with time zone,
  dryer_completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT laundry_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT laundry_sessions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT laundry_sessions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.household_members(id),
  CONSTRAINT laundry_sessions_unique_member_date UNIQUE (household_id, member_id, date)
);

-- RLS policies (DISABLED to match other tables without RLS)
ALTER TABLE public.laundry_sessions DISABLE ROW LEVEL SECURITY;
