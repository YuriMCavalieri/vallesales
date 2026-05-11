-- Permite excluir etapas intermediarias do funil por admin e gestor,
-- impedindo remocao de etapas finais e de etapas com leads vinculados.

CREATE OR REPLACE FUNCTION public.delete_pipeline_stage(
  _funnel_id uuid,
  _stage_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target public.pipeline_stages;
  _lead_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_manage_team() THEN
    RAISE EXCEPTION 'Sem permissao para excluir etapas do funil.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_user_has_funnel_access(_funnel_id) THEN
    RAISE EXCEPTION 'Sem permissao para acessar este funil.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO _target
  FROM public.pipeline_stages
  WHERE id = _stage_id
    AND funnel_id = _funnel_id;

  IF _target IS NULL THEN
    RAISE EXCEPTION 'Etapa do funil nao encontrada.'
      USING ERRCODE = 'P0002';
  END IF;

  IF _target.is_won OR _target.is_lost THEN
    RAISE EXCEPTION 'As etapas finais de ganho ou perda nao podem ser excluidas.'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*)
  INTO _lead_count
  FROM public.leads
  WHERE funnel_id = _funnel_id
    AND stage_id = _stage_id;

  IF _lead_count > 0 THEN
    RAISE EXCEPTION 'Nao e possivel excluir uma etapa que ainda possui leads vinculados.'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.pipeline_stages
  WHERE id = _stage_id
    AND funnel_id = _funnel_id;

  UPDATE public.pipeline_stages
  SET position = position - 1
  WHERE funnel_id = _funnel_id
    AND position > _target.position;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_pipeline_stage(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_pipeline_stage(uuid, uuid) TO authenticated;
