
-- Funções auxiliares
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_active FROM public.profiles WHERE id = _user_id), false)
$$;

REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon, authenticated;

-- ============ LEADS ============
DROP POLICY IF EXISTS "Auth read leads" ON public.leads;
DROP POLICY IF EXISTS "Auth insert leads" ON public.leads;
DROP POLICY IF EXISTS "Auth update leads" ON public.leads;
DROP POLICY IF EXISTS "Auth delete leads" ON public.leads;

-- SELECT: admin/gestor/visualizador veem tudo; consultor vê só seus
CREATE POLICY "Leads select by role" ON public.leads
FOR SELECT TO authenticated
USING (
  public.is_active_user(auth.uid())
  AND (
    public.has_any_role(auth.uid(), ARRAY['admin','gestor','visualizador']::app_role[])
    OR (
      public.has_role(auth.uid(), 'consultor')
      AND (owner_id = auth.uid() OR created_by = auth.uid())
    )
  )
);

-- INSERT: admin/gestor/consultor (consultor deve atribuir a si mesmo)
CREATE POLICY "Leads insert by role" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user(auth.uid())
  AND (
    public.has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[])
    OR (
      public.has_role(auth.uid(), 'consultor')
      AND (owner_id = auth.uid() OR owner_id IS NULL)
    )
  )
);

-- UPDATE: admin/gestor tudo; consultor só os seus
CREATE POLICY "Leads update by role" ON public.leads
FOR UPDATE TO authenticated
USING (
  public.is_active_user(auth.uid())
  AND (
    public.has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[])
    OR (
      public.has_role(auth.uid(), 'consultor')
      AND (owner_id = auth.uid() OR created_by = auth.uid())
    )
  )
);

-- DELETE: apenas admin/gestor
CREATE POLICY "Leads delete by role" ON public.leads
FOR DELETE TO authenticated
USING (
  public.is_active_user(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[])
);

-- ============ PROFILES ============
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admin/gestor update any profile" ON public.profiles
FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));

-- ============ USER_ROLES ============
DROP POLICY IF EXISTS "Admins manage roles - insert" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles - update" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles - delete" ON public.user_roles;

CREATE POLICY "Admin/gestor manage roles - insert" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));

CREATE POLICY "Admin/gestor manage roles - update" ON public.user_roles
FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));

CREATE POLICY "Admin/gestor manage roles - delete" ON public.user_roles
FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
