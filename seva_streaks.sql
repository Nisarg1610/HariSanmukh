-- ============================================================
--  seva_streaks  –  tracks each member's seva completion streak
-- ============================================================

CREATE TABLE IF NOT EXISTS public.seva_streaks (
  id                uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id      uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id         uuid NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  current_streak    integer NOT NULL DEFAULT 0,
  longest_streak    integer NOT NULL DEFAULT 0,
  last_completed_date date,
  updated_at        timestamp with time zone DEFAULT now(),
  UNIQUE(household_id, member_id)
);

-- Enable RLS
ALTER TABLE public.seva_streaks ENABLE ROW LEVEL SECURITY;

-- Allow anyone authenticated to read streaks
CREATE POLICY "seva_streaks_select"
  ON public.seva_streaks FOR SELECT
  USING (true);

-- Allow INSERT (needed for upsert when row doesn't exist yet)
CREATE POLICY "seva_streaks_insert"
  ON public.seva_streaks FOR INSERT
  WITH CHECK (true);

-- Allow UPDATE (needed for upsert when row already exists)
CREATE POLICY "seva_streaks_update"
  ON public.seva_streaks FOR UPDATE
  USING (true)
  WITH CHECK (true);
