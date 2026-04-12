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

-- Insert starting configurations for all 5 households dynamically linking to their ID
DO $$
DECLARE
  hs_id uuid;
  hr_id uuid;
  hn_id uuid;
  hc_id uuid;
  sv_id uuid;
BEGIN
  SELECT id INTO hs_id FROM public.households WHERE name = 'HariSanmukh' LIMIT 1;
  SELECT id INTO hr_id FROM public.households WHERE name = 'HariSharan' LIMIT 1;
  SELECT id INTO hn_id FROM public.households WHERE name = 'HariNaman' LIMIT 1;
  SELECT id INTO hc_id FROM public.households WHERE name = 'HariChintan' LIMIT 1;
  SELECT id INTO sv_id FROM public.households WHERE name = 'SuhradVihar' LIMIT 1;

  -- HariSanmukh
  IF hs_id IS NOT NULL THEN
    INSERT INTO public.house_configs (household_id, wifi_name, wifi_pass, house_lock, garbage_calendar_id, recycle_calendar_id)
    VALUES (
      hs_id, 'Gunatit', 'Dasnadas@369', '••••',
      'n4l25rmpgor2a1hedeege6ejbuhl3j1t@import.calendar.google.com',
      '5sfp0o5al962uod59qlfp7sssmtrgehm@import.calendar.google.com'
    ) ON CONFLICT (household_id) DO UPDATE SET 
      wifi_name = EXCLUDED.wifi_name, 
      wifi_pass = EXCLUDED.wifi_pass,
      house_lock = EXCLUDED.house_lock;
  END IF;

  -- HariSharan
  IF hr_id IS NOT NULL THEN
    INSERT INTO public.house_configs (household_id, wifi_name, wifi_pass, house_lock, garbage_calendar_id, recycle_calendar_id)
    VALUES (
      hr_id, 'Swaminarayan', 'Hari@123', '••••',
      'n4l25rmpgor2a1hedeege6ejbuhl3j1t@import.calendar.google.com',
      '5sfp0o5al962uod59qlfp7sssmtrgehm@import.calendar.google.com'
    ) ON CONFLICT (household_id) DO UPDATE SET 
      wifi_name = EXCLUDED.wifi_name, 
      wifi_pass = EXCLUDED.wifi_pass,
      house_lock = EXCLUDED.house_lock;
  END IF;

  -- HariNaman
  IF hn_id IS NOT NULL THEN
    INSERT INTO public.house_configs (household_id, wifi_name, wifi_pass, house_lock, garbage_calendar_id, recycle_calendar_id)
    VALUES (
      hn_id, 'Yogi', 'Bapa@369', '••••',
      'n4l25rmpgor2a1hedeege6ejbuhl3j1t@import.calendar.google.com',
      '5sfp0o5al962uod59qlfp7sssmtrgehm@import.calendar.google.com'
    ) ON CONFLICT (household_id) DO UPDATE SET 
      wifi_name = EXCLUDED.wifi_name, 
      wifi_pass = EXCLUDED.wifi_pass,
      house_lock = EXCLUDED.house_lock;
  END IF;

  -- HariChintan
  IF hc_id IS NOT NULL THEN
    INSERT INTO public.house_configs (household_id, wifi_name, wifi_pass, house_lock, garbage_calendar_id, recycle_calendar_id)
    VALUES (
      hc_id, 'Pramukh', 'Swami@123', '••••',
      'n4l25rmpgor2a1hedeege6ejbuhl3j1t@import.calendar.google.com',
      '5sfp0o5al962uod59qlfp7sssmtrgehm@import.calendar.google.com'
    ) ON CONFLICT (household_id) DO UPDATE SET 
      wifi_name = EXCLUDED.wifi_name, 
      wifi_pass = EXCLUDED.wifi_pass,
      house_lock = EXCLUDED.house_lock;
  END IF;

  -- SuhradVihar
  IF sv_id IS NOT NULL THEN
    INSERT INTO public.house_configs (household_id, wifi_name, wifi_pass, house_lock, garbage_calendar_id, recycle_calendar_id)
    VALUES (
      sv_id, 'Mahant', 'Swami@369', '••••',
      'n4l25rmpgor2a1hedeege6ejbuhl3j1t@import.calendar.google.com',
      '5sfp0o5al962uod59qlfp7sssmtrgehm@import.calendar.google.com'
    ) ON CONFLICT (household_id) DO UPDATE SET 
      wifi_name = EXCLUDED.wifi_name, 
      wifi_pass = EXCLUDED.wifi_pass,
      house_lock = EXCLUDED.house_lock;
  END IF;

END $$;
