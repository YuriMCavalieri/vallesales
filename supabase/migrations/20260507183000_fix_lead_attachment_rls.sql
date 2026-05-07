CREATE OR REPLACE FUNCTION public.current_user_can_access_lead(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.current_user_is_active()
    AND EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = _lead_id
        AND public.user_has_funnel_access(auth.uid(), l.funnel_id)
        AND (
          public.current_user_has_any_role(ARRAY['admin','gestor','visualizador']::public.app_role[])
          OR (
            public.current_user_has_role('consultor')
            AND (l.owner_id = auth.uid() OR l.created_by = auth.uid())
          )
        )
    )
$$;

DROP POLICY IF EXISTS "Auth insert activities" ON public.lead_activities;
CREATE POLICY "Auth insert activities" ON public.lead_activities
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.current_user_can_access_lead(lead_id));

DROP POLICY IF EXISTS "Auth insert attachments" ON public.lead_attachments;
CREATE POLICY "Auth insert attachments" ON public.lead_attachments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.current_user_can_access_lead(lead_id));

DROP POLICY IF EXISTS "Auth upload lead attachments" ON storage.objects;
CREATE POLICY "Auth upload lead attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lead-attachments'
    AND public.current_user_can_access_lead(public.storage_object_lead_id(name))
  );

GRANT EXECUTE ON FUNCTION public.current_user_can_access_lead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_object_lead_id(text) TO authenticated;
