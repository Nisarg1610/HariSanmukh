-- =============================================
-- Migration: Pick & Drop assignments + Sabha absence reasons
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Pick & Drop assignments (like laundry but for seva pick & drop)
CREATE TABLE IF NOT EXISTS public.pickup_drop_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  day_of_week text NOT NULL CHECK (day_of_week = ANY (ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])),
  created_at timestamp with time zone DEFAULT now()
);

-- RLS for pickup_drop_assignments
ALTER TABLE public.pickup_drop_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.pickup_drop_assignments
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Sabha absence reasons (stores why someone said "No" to sabha)
CREATE TABLE IF NOT EXISTS public.sabha_absence_reasons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  member_email text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS for sabha_absence_reasons
ALTER TABLE public.sabha_absence_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.sabha_absence_reasons
  FOR ALL USING (true) WITH CHECK (true);
