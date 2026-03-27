-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.garbage_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid,
  member_id uuid,
  scheduled_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT garbage_schedule_pkey PRIMARY KEY (id),
  CONSTRAINT garbage_schedule_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT garbage_schedule_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.household_members(id)
);
CREATE TABLE public.grocery_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid,
  name text NOT NULL,
  quantity text,
  category text NOT NULL DEFAULT 'General'::text,
  list_type text NOT NULL CHECK (list_type = ANY (ARRAY['weekly'::text, 'monthly'::text])),
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT grocery_items_pkey PRIMARY KEY (id),
  CONSTRAINT grocery_items_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id)
);
CREATE TABLE public.grocery_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid,
  member_id uuid,
  list_type text NOT NULL CHECK (list_type = ANY (ARRAY['weekly'::text, 'monthly'::text])),
  suggestion text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT grocery_suggestions_pkey PRIMARY KEY (id),
  CONSTRAINT grocery_suggestions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT grocery_suggestions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.household_members(id)
);
CREATE TABLE public.household_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid,
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT 'Bhai'::text,
  email text UNIQUE,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  linked_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  phone text,
  CONSTRAINT household_members_pkey PRIMARY KEY (id),
  CONSTRAINT household_members_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id)
);
CREATE TABLE public.households (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT households_pkey PRIMARY KEY (id)
);
CREATE TABLE public.laundry_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid,
  member_id uuid,
  day_of_week text NOT NULL CHECK (day_of_week = ANY (ARRAY['Monday'::text, 'Tuesday'::text, 'Wednesday'::text, 'Thursday'::text, 'Friday'::text, 'Saturday'::text, 'Sunday'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT laundry_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT laundry_assignments_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT laundry_assignments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.household_members(id)
);
CREATE TABLE public.passkeys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  device_type text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT passkeys_pkey PRIMARY KEY (id),
  CONSTRAINT passkeys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid,
  user_id uuid UNIQUE,
  subscription jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.seva_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seva_id uuid,
  member_id uuid,
  is_completed boolean NOT NULL DEFAULT false,
  assigned_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT seva_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT seva_assignments_seva_id_fkey FOREIGN KEY (seva_id) REFERENCES public.sevas(id),
  CONSTRAINT seva_assignments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.household_members(id)
);
CREATE TABLE public.sevas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid,
  name text NOT NULL,
  description text,
  cap integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sevas_pkey PRIMARY KEY (id),
  CONSTRAINT sevas_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id)
);
CREATE TABLE public.sikshapatri (
  id integer NOT NULL DEFAULT nextval('sikshapatri_id_seq'::regclass),
  shloka_number integer,
  gujarati_text text,
  CONSTRAINT sikshapatri_pkey PRIMARY KEY (id)
);
CREATE TABLE public.swaminivato (
  id integer NOT NULL DEFAULT nextval('swaminivato_id_seq'::regclass),
  vat_number integer,
  gujarati_text text,
  reference character varying,
  CONSTRAINT swaminivato_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT 'Bhai'::text,
  household_id uuid,
  role text NOT NULL DEFAULT 'user'::text CHECK (role = ANY (ARRAY['admin'::text, 'user'::text])),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  created_at timestamp with time zone DEFAULT now(),
  welcome_sent boolean NOT NULL DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT users_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id)
);