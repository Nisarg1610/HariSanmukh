CREATE TABLE IF NOT EXISTS public.house_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  wifi_name text,
  wifi_pass text,
  house_lock text,
  garbage_calendar_id text,
  recycle_calendar_id text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(household_id)
);
