-- Reconcile legacy Lovable/Supabase schema with the current CRM schema.
-- This migration is intentionally defensive because the target project may
-- already contain an older schema with production data.

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'gestor', 'consultor', 'visualizador');
  END IF;
END $$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'consultor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'visualizador';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'lead_temperature') THEN
    CREATE TYPE public.lead_temperature AS ENUM ('frio', 'morno', 'quente');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'contact_method') THEN
    CREATE TYPE public.contact_method AS ENUM ('whatsapp', 'ligacao', 'email', 'reuniao', 'indicacao', 'outro');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'activity_type') THEN
    CREATE TYPE public.activity_type AS ENUM (
      'stage_change',
      'note_added',
      'contact_logged',
      'attachment_added',
      'lead_created',
      'lead_updated',
      'owner_change'
    );
  END IF;
END $$;

ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'owner_change';

BEGIN;

-- Common updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN name TO full_name;
  END IF;
END $$;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_receive_leads boolean NOT NULL DEFAULT true;
UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;
UPDATE public.profiles SET can_receive_leads = true WHERE can_receive_leads IS NULL;

-- User roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT
      id,
      CASE
        WHEN role IN ('admin', 'gestor', 'consultor', 'visualizador', 'user') THEN role::public.app_role
        ELSE 'user'::public.app_role
      END
    FROM public.profiles
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Pipeline stages
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS key text;
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS is_won boolean NOT NULL DEFAULT false;
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS is_lost boolean NOT NULL DEFAULT false;
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.pipeline_stages
SET
  key = CASE position
    WHEN 1 THEN 'novo_lead'
    WHEN 2 THEN 'primeiro_contato'
    WHEN 3 THEN 'reuniao_marcada'
    WHEN 4 THEN 'proposta_enviada'
    WHEN 5 THEN 'em_negociacao'
    WHEN 6 THEN 'fechado'
    WHEN 7 THEN 'perdido'
    ELSE COALESCE(key, 'stage_' || position::text)
  END,
  color = CASE position
    WHEN 1 THEN '#3B82F6'
    WHEN 2 THEN '#8B5CF6'
    WHEN 3 THEN '#06B6D4'
    WHEN 4 THEN '#F59E0B'
    WHEN 5 THEN '#EF4444'
    WHEN 6 THEN '#10B981'
    WHEN 7 THEN '#6B7280'
    ELSE color
  END,
  is_won = position = 6,
  is_lost = position = 7
WHERE key IS NULL OR color IS NULL OR position IN (6, 7);

ALTER TABLE public.pipeline_stages ALTER COLUMN key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_key_key ON public.pipeline_stages(key);

-- Leads legacy column names
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'company_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'company_or_person'
  ) THEN
    ALTER TABLE public.leads RENAME COLUMN company_name TO company_or_person;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'state'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'uf'
  ) THEN
    ALTER TABLE public.leads RENAME COLUMN state TO uf;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'responsible_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.leads RENAME COLUMN responsible_id TO owner_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'contacted'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'has_been_contacted'
  ) THEN
    ALTER TABLE public.leads RENAME COLUMN contacted TO has_been_contacted;
  END IF;
END $$;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_temperature_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'temperature'
      AND udt_name <> 'lead_temperature'
  ) THEN
    ALTER TABLE public.leads
      ALTER COLUMN temperature TYPE public.lead_temperature
      USING CASE lower(coalesce(temperature::text, 'morno'))
        WHEN 'frio' THEN 'frio'::public.lead_temperature
        WHEN 'quente' THEN 'quente'::public.lead_temperature
        ELSE 'morno'::public.lead_temperature
      END;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'contact_method'
      AND udt_name <> 'contact_method'
  ) THEN
    ALTER TABLE public.leads
      ALTER COLUMN contact_method TYPE public.contact_method
      USING CASE lower(nullif(contact_method::text, ''))
        WHEN 'whatsapp' THEN 'whatsapp'::public.contact_method
        WHEN 'ligacao' THEN 'ligacao'::public.contact_method
        WHEN 'email' THEN 'email'::public.contact_method
        WHEN 'reuniao' THEN 'reuniao'::public.contact_method
        WHEN 'indicacao' THEN 'indicacao'::public.contact_method
        WHEN 'outro' THEN 'outro'::public.contact_method
        ELSE NULL
      END;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'next_follow_up'
      AND data_type <> 'date'
  ) THEN
    ALTER TABLE public.leads
      ALTER COLUMN next_follow_up TYPE date
      USING next_follow_up::date;
  END IF;
END $$;

ALTER TABLE public.leads ALTER COLUMN temperature SET DEFAULT 'morno'::public.lead_temperature;
ALTER TABLE public.leads ALTER COLUMN temperature SET NOT NULL;
ALTER TABLE public.leads ALTER COLUMN has_been_contacted SET DEFAULT false;
ALTER TABLE public.leads ALTER COLUMN has_been_contacted SET NOT NULL;

-- Lead notes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_notes' AND column_name = 'note'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_notes' AND column_name = 'content'
  ) THEN
    ALTER TABLE public.lead_notes RENAME COLUMN note TO content;
  END IF;
END $$;
ALTER TABLE public.lead_notes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.lead_notes ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Lead activities
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_activities' AND column_name = 'activity_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_activities' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.lead_activities RENAME COLUMN activity_type TO type;
  END IF;
END $$;
ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS contact_method public.contact_method;
ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS updated_by uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lead_activities'
      AND column_name = 'type'
      AND udt_name <> 'activity_type'
  ) THEN
    ALTER TABLE public.lead_activities
      ALTER COLUMN type TYPE public.activity_type
      USING CASE lower(coalesce(type::text, 'lead_updated'))
        WHEN 'stage_change' THEN 'stage_change'::public.activity_type
        WHEN 'note_added' THEN 'note_added'::public.activity_type
        WHEN 'contact_logged' THEN 'contact_logged'::public.activity_type
        WHEN 'attachment_added' THEN 'attachment_added'::public.activity_type
        WHEN 'lead_created' THEN 'lead_created'::public.activity_type
        WHEN 'owner_change' THEN 'owner_change'::public.activity_type
        ELSE 'lead_updated'::public.activity_type
      END;
  END IF;
END $$;

-- Lead attachments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_attachments' AND column_name = 'file_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_attachments' AND column_name = 'mime_type'
  ) THEN
    ALTER TABLE public.lead_attachments RENAME COLUMN file_type TO mime_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_attachments' AND column_name = 'uploaded_by'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_attachments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.lead_attachments RENAME COLUMN uploaded_by TO created_by;
  END IF;
END $$;
ALTER TABLE public.lead_attachments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.lead_attachments ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Indexes
CREATE INDEX IF NOT EXISTS leads_stage_idx ON public.leads(stage_id);
CREATE INDEX IF NOT EXISTS leads_owner_idx ON public.leads(owner_id);
CREATE INDEX IF NOT EXISTS lead_notes_lead_idx ON public.lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS lead_activities_lead_idx ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS lead_attachments_lead_idx ON public.lead_attachments(lead_id);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_attachments ENABLE ROW LEVEL SECURITY;

-- Role helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_active FROM public.profiles WHERE id = _user_id), false)
$$;

-- Activity triggers
CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_stage_name text;
  new_stage_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    SELECT name INTO old_stage_name FROM public.pipeline_stages WHERE id = OLD.stage_id;
    SELECT name INTO new_stage_name FROM public.pipeline_stages WHERE id = NEW.stage_id;
    INSERT INTO public.lead_activities (lead_id, type, description, metadata, created_by)
    VALUES (
      NEW.id,
      'stage_change',
      'Etapa alterada de "' || COALESCE(old_stage_name, '?') || '" para "' || COALESCE(new_stage_name, '?') || '"',
      jsonb_build_object('from', OLD.stage_id, 'to', NEW.stage_id),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_lead_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_owner_name text;
  new_owner_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    SELECT COALESCE(full_name, email) INTO old_owner_name FROM public.profiles WHERE id = OLD.owner_id;
    SELECT COALESCE(full_name, email) INTO new_owner_name FROM public.profiles WHERE id = NEW.owner_id;
    INSERT INTO public.lead_activities (lead_id, type, description, metadata, created_by)
    VALUES (
      NEW.id,
      'owner_change',
      'Responsavel alterado de "' || COALESCE(old_owner_name, 'sem responsavel') || '" para "' || COALESCE(new_owner_name, 'sem responsavel') || '"',
      jsonb_build_object('from', OLD.owner_id, 'to', NEW.owner_id),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_lead_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.lead_activities (lead_id, type, description, created_by)
  VALUES (NEW.id, 'lead_created', 'Lead criado: ' || NEW.company_or_person, auth.uid());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first_user;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first_user THEN 'admin'::public.app_role ELSE 'user'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS pipeline_stages_updated_at ON public.pipeline_stages;
CREATE TRIGGER pipeline_stages_updated_at BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS lead_notes_updated_at ON public.lead_notes;
CREATE TRIGGER lead_notes_updated_at BEFORE UPDATE ON public.lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS lead_activities_updated_at ON public.lead_activities;
CREATE TRIGGER lead_activities_updated_at BEFORE UPDATE ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS lead_attachments_updated_at ON public.lead_attachments;
CREATE TRIGGER lead_attachments_updated_at BEFORE UPDATE ON public.lead_attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS leads_stage_change_log ON public.leads;
DROP TRIGGER IF EXISTS trg_log_lead_stage_change ON public.leads;
CREATE TRIGGER trg_log_lead_stage_change AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_stage_change();

DROP TRIGGER IF EXISTS leads_created_log ON public.leads;
DROP TRIGGER IF EXISTS trg_log_lead_created ON public.leads;
CREATE TRIGGER trg_log_lead_created AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_created();

DROP TRIGGER IF EXISTS trg_log_lead_owner_change ON public.leads;
CREATE TRIGGER trg_log_lead_owner_change AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_owner_change();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Policies
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin/gestor update any profile" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admin/gestor update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor']::public.app_role[]));

DROP POLICY IF EXISTS "Authenticated users view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles - insert" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles - update" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles - delete" ON public.user_roles;
DROP POLICY IF EXISTS "Admin/gestor manage roles - insert" ON public.user_roles;
DROP POLICY IF EXISTS "Admin/gestor manage roles - update" ON public.user_roles;
DROP POLICY IF EXISTS "Admin/gestor manage roles - delete" ON public.user_roles;
CREATE POLICY "Authenticated users view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/gestor manage roles - insert" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor']::public.app_role[]));
CREATE POLICY "Admin/gestor manage roles - update" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor']::public.app_role[]));
CREATE POLICY "Admin/gestor manage roles - delete" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor']::public.app_role[]));

DROP POLICY IF EXISTS "Authenticated users can view pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Authenticated read stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Admins manage stages - insert" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Admins manage stages - update" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Admins manage stages - delete" ON public.pipeline_stages;
CREATE POLICY "Authenticated read stages" ON public.pipeline_stages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage stages - insert" ON public.pipeline_stages
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage stages - update" ON public.pipeline_stages
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage stages - delete" ON public.pipeline_stages
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can manage leads" ON public.leads;
DROP POLICY IF EXISTS "Auth read leads" ON public.leads;
DROP POLICY IF EXISTS "Auth insert leads" ON public.leads;
DROP POLICY IF EXISTS "Auth update leads" ON public.leads;
DROP POLICY IF EXISTS "Auth delete leads" ON public.leads;
DROP POLICY IF EXISTS "Leads select by role" ON public.leads;
DROP POLICY IF EXISTS "Leads insert by role" ON public.leads;
DROP POLICY IF EXISTS "Leads update by role" ON public.leads;
DROP POLICY IF EXISTS "Leads delete by role" ON public.leads;
CREATE POLICY "Leads select by role" ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin','gestor','visualizador']::public.app_role[])
      OR (
        public.has_role(auth.uid(), 'consultor')
        AND (owner_id = auth.uid() OR created_by = auth.uid())
      )
    )
  );
CREATE POLICY "Leads insert by role" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin','gestor']::public.app_role[])
      OR (
        public.has_role(auth.uid(), 'consultor')
        AND (owner_id = auth.uid() OR owner_id IS NULL)
      )
    )
  );
CREATE POLICY "Leads update by role" ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin','gestor']::public.app_role[])
      OR (
        public.has_role(auth.uid(), 'consultor')
        AND (owner_id = auth.uid() OR created_by = auth.uid())
      )
    )
  );
CREATE POLICY "Leads delete by role" ON public.leads
  FOR DELETE TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['admin','gestor']::public.app_role[])
  );

DROP POLICY IF EXISTS "Authenticated users can manage lead notes" ON public.lead_notes;
DROP POLICY IF EXISTS "Auth read notes" ON public.lead_notes;
DROP POLICY IF EXISTS "Auth insert notes" ON public.lead_notes;
DROP POLICY IF EXISTS "Auth update own notes" ON public.lead_notes;
DROP POLICY IF EXISTS "Auth delete own notes" ON public.lead_notes;
CREATE POLICY "Auth read notes" ON public.lead_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert notes" ON public.lead_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update own notes" ON public.lead_notes FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth delete own notes" ON public.lead_notes FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can manage lead activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Auth read activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Auth insert activities" ON public.lead_activities;
CREATE POLICY "Auth read activities" ON public.lead_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert activities" ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage lead attachments" ON public.lead_attachments;
DROP POLICY IF EXISTS "Auth read attachments" ON public.lead_attachments;
DROP POLICY IF EXISTS "Auth insert attachments" ON public.lead_attachments;
DROP POLICY IF EXISTS "Auth delete own attachments" ON public.lead_attachments;
CREATE POLICY "Auth read attachments" ON public.lead_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert attachments" ON public.lead_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete own attachments" ON public.lead_attachments FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-attachments', 'lead-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can view lead attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload lead attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete lead attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth read lead attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload lead attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete lead attachments" ON storage.objects;
CREATE POLICY "Auth read lead attachments" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'lead-attachments');
CREATE POLICY "Auth upload lead attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lead-attachments');
CREATE POLICY "Auth delete lead attachments" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'lead-attachments');

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_lead_stage_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_lead_owner_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_lead_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

COMMIT;
