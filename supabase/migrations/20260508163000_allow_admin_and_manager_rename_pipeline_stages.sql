-- Permite renomear etapas do funil por admin e gestor, mantendo o escopo por funil.

CREATE OR REPLACE FUNCTION public.rename_pipeline_stage(
  _funnel_id uuid,
  _stage_id uuid,
  _name text
)
RETURNS public.pipeline_stages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean_name text := trim(coalesce(_name, ''));
  _result public.pipeline_stages;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_manage_team() THEN
    RAISE EXCEPTION 'Sem permissao para renomear etapas do funil.'
      USING ERRCODE = '42501';
  END IF;

  IF _clean_name = '' THEN
    RAISE EXCEPTION 'Informe o nome da etapa.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.current_user_has_funnel_access(_funnel_id) THEN
    RAISE EXCEPTION 'Sem permissao para acessar este funil.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.pipeline_stages
  SET name = _clean_name
  WHERE id = _stage_id
    AND funnel_id = _funnel_id
  RETURNING * INTO _result;

  IF _result IS NULL THEN
    RAISE EXCEPTION 'Etapa do funil nao encontrada.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN _result;
END;
$$;

DROP POLICY IF EXISTS "Admins manage stages - update" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Managers manage stages - update" ON public.pipeline_stages;
CREATE POLICY "Managers manage stages - update" ON public.pipeline_stages
  FOR UPDATE TO authenticated
  USING (
    public.current_user_is_active()
    AND public.current_user_can_manage_team()
    AND public.current_user_has_funnel_access(funnel_id)
  )
  WITH CHECK (
    public.current_user_is_active()
    AND public.current_user_can_manage_team()
    AND public.current_user_has_funnel_access(funnel_id)
  );

REVOKE EXECUTE ON FUNCTION public.rename_pipeline_stage(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_pipeline_stage(uuid, uuid, text) TO authenticated;
