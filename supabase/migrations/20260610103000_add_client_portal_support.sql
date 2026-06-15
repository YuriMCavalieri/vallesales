DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cliente';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

ALTER TABLE public.project_tracking_projects
  ADD COLUMN IF NOT EXISTS client_portal_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS project_tracking_projects_client_portal_user_idx
  ON public.project_tracking_projects (client_portal_user_id)
  WHERE client_portal_user_id IS NOT NULL;

ALTER TABLE public.referral_program_entries
  ADD COLUMN IF NOT EXISTS referrer_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS referral_program_entries_referrer_user_idx
  ON public.referral_program_entries (referrer_user_id)
  WHERE referrer_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_owner boolean := public.is_owner_email(NEW.email);
  _is_client boolean := lower(COALESCE(NEW.raw_user_meta_data->>'portal_type', '')) = 'cliente';
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    avatar_url,
    access_status,
    is_active,
    can_receive_leads
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN _is_owner OR _is_client THEN 'active'::public.user_access_status
      ELSE 'pending'::public.user_access_status
    END,
    (_is_owner OR _is_client),
    _is_owner
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    access_status = CASE
      WHEN public.is_owner_email(EXCLUDED.email) THEN 'active'::public.user_access_status
      WHEN lower(COALESCE(NEW.raw_user_meta_data->>'portal_type', '')) = 'cliente' THEN 'active'::public.user_access_status
      ELSE public.profiles.access_status
    END,
    is_active = CASE
      WHEN public.is_owner_email(EXCLUDED.email) THEN true
      WHEN lower(COALESCE(NEW.raw_user_meta_data->>'portal_type', '')) = 'cliente' THEN true
      ELSE public.profiles.is_active
    END,
    can_receive_leads = CASE
      WHEN public.is_owner_email(EXCLUDED.email) THEN true
      ELSE public.profiles.can_receive_leads
    END;

  IF _is_owner THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.id
      AND role <> 'admin';

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF _is_client THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'cliente'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
