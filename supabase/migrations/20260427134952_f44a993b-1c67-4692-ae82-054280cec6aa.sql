
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.lead_temperature AS ENUM ('frio', 'morno', 'quente');
CREATE TYPE public.contact_method AS ENUM ('whatsapp', 'ligacao', 'email', 'reuniao', 'indicacao', 'outro');
CREATE TYPE public.activity_type AS ENUM ('stage_change', 'note_added', 'contact_logged', 'attachment_added', 'lead_created', 'lead_updated');

-- ============ UTIL: updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ PIPELINE_STAGES ============
CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT,
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER pipeline_stages_updated_at BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.pipeline_stages (key, name, position, color, is_won, is_lost) VALUES
  ('novo_lead', 'Novo lead', 1, '#3B82F6', false, false),
  ('primeiro_contato', 'Primeiro contato', 2, '#8B5CF6', false, false),
  ('reuniao_marcada', 'Reunião marcada', 3, '#06B6D4', false, false),
  ('proposta_enviada', 'Proposta enviada', 4, '#F59E0B', false, false),
  ('em_negociacao', 'Em negociação', 5, '#EF4444', false, false),
  ('fechado', 'Fechado', 6, '#10B981', true, false),
  ('perdido', 'Perdido', 7, '#6B7280', false, true);

-- ============ LEADS ============
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_or_person TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  source TEXT,
  segment TEXT,
  city TEXT,
  uf TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  estimated_value NUMERIC(14,2) DEFAULT 0,
  temperature lead_temperature NOT NULL DEFAULT 'morno',
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
  has_been_contacted BOOLEAN NOT NULL DEFAULT false,
  contact_method contact_method,
  next_follow_up DATE,
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE INDEX leads_stage_idx ON public.leads(stage_id);
CREATE INDEX leads_owner_idx ON public.leads(owner_id);
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ LEAD_NOTES ============
CREATE TABLE public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX lead_notes_lead_idx ON public.lead_notes(lead_id);
CREATE TRIGGER lead_notes_updated_at BEFORE UPDATE ON public.lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ LEAD_ACTIVITIES ============
CREATE TABLE public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type activity_type NOT NULL,
  description TEXT,
  metadata JSONB,
  contact_method contact_method,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
CREATE INDEX lead_activities_lead_idx ON public.lead_activities(lead_id);
CREATE TRIGGER lead_activities_updated_at BEFORE UPDATE ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ LEAD_ATTACHMENTS ============
CREATE TABLE public.lead_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.lead_attachments ENABLE ROW LEVEL SECURITY;
CREATE INDEX lead_attachments_lead_idx ON public.lead_attachments(lead_id);
CREATE TRIGGER lead_attachments_updated_at BEFORE UPDATE ON public.lead_attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ TRIGGER: stage change activity ============
CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_stage_name TEXT;
  new_stage_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    SELECT name INTO old_stage_name FROM public.pipeline_stages WHERE id = OLD.stage_id;
    SELECT name INTO new_stage_name FROM public.pipeline_stages WHERE id = NEW.stage_id;
    INSERT INTO public.lead_activities (lead_id, type, description, metadata, created_by)
    VALUES (NEW.id, 'stage_change',
      'Etapa alterada de "' || COALESCE(old_stage_name,'?') || '" para "' || COALESCE(new_stage_name,'?') || '"',
      jsonb_build_object('from', OLD.stage_id, 'to', NEW.stage_id),
      auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER leads_stage_change_log AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_stage_change();

-- ============ TRIGGER: lead created activity ============
CREATE OR REPLACE FUNCTION public.log_lead_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.lead_activities (lead_id, type, description, created_by)
  VALUES (NEW.id, 'lead_created', 'Lead criado: ' || NEW.company_or_person, auth.uid());
  RETURN NEW;
END;
$$;
CREATE TRIGGER leads_created_log AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_created();

-- ============ TRIGGER: profile + role on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  SELECT NOT EXISTS(SELECT 1 FROM public.user_roles) INTO is_first_user;
  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "Authenticated users view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles - insert" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles - update" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles - delete" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- pipeline_stages
CREATE POLICY "Authenticated read stages" ON public.pipeline_stages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage stages - insert" ON public.pipeline_stages
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage stages - update" ON public.pipeline_stages
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage stages - delete" ON public.pipeline_stages
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- leads (todos os autenticados veem/editam tudo)
CREATE POLICY "Auth read leads" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update leads" ON public.leads FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete leads" ON public.leads FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- lead_notes
CREATE POLICY "Auth read notes" ON public.lead_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert notes" ON public.lead_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update own notes" ON public.lead_notes FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Auth delete own notes" ON public.lead_notes FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- lead_activities
CREATE POLICY "Auth read activities" ON public.lead_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert activities" ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- lead_attachments
CREATE POLICY "Auth read attachments" ON public.lead_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert attachments" ON public.lead_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete own attachments" ON public.lead_attachments FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public) VALUES ('lead-attachments', 'lead-attachments', false);

CREATE POLICY "Auth read lead attachments" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'lead-attachments');
CREATE POLICY "Auth upload lead attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lead-attachments');
CREATE POLICY "Auth delete lead attachments" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'lead-attachments');
