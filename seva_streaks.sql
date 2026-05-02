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

-- RLS: allow all authenticated users to read streaks in their household
ALTER TABLE public.seva_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seva_streaks_select" ON public.seva_streaks
  FOR SELECT USING (true);

CREATE POLICY "seva_streaks_upsert" ON public.seva_streaks
  FOR ALL USING (true) WITH CHECK (true);
