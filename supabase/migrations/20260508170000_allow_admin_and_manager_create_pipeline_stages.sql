-- Permite criar etapas por admin e gestor, mantendo o escopo por funil
-- e preservando as etapas finais no fim do fluxo.

CREATE OR REPLACE FUNCTION public.create_pipeline_stage(
  _funnel_id uuid,
  _name text,
  _after_stage_id uuid DEFAULT NULL
)
RETURNS public.pipeline_stages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean_name text := trim(coalesce(_name, ''));
  _insert_position integer;
  _after_stage public.pipeline_stages;
  _result public.pipeline_stages;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_manage_team() THEN
    RAISE EXCEPTION 'Sem permissao para criar etapas do funil.'
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

  IF _after_stage_id IS NOT NULL THEN
    SELECT *
    INTO _after_stage
    FROM public.pipeline_stages
    WHERE id = _after_stage_id
      AND funnel_id = _funnel_id;

    IF _after_stage IS NULL THEN
      RAISE EXCEPTION 'Etapa de referencia nao encontrada neste funil.'
        USING ERRCODE = 'P0002';
    END IF;

    IF _after_stage.is_won OR _after_stage.is_lost THEN
      _insert_position := _after_stage.position;
    ELSE
      _insert_position := _after_stage.position + 1;
    END IF;
  ELSE
    SELECT min(position)
    INTO _insert_position
    FROM public.pipeline_stages
    WHERE funnel_id = _funnel_id
      AND (is_won = true OR is_lost = true);

    IF _insert_position IS NULL THEN
      SELECT coalesce(max(position), 0) + 1
      INTO _insert_position
      FROM public.pipeline_stages
      WHERE funnel_id = _funnel_id;
    END IF;
  END IF;

  UPDATE public.pipeline_stages
  SET position = position + 1
  WHERE funnel_id = _funnel_id
    AND position >= _insert_position;

  INSERT INTO public.pipeline_stages (
    funnel_id,
    key,
    name,
    position,
    color,
    is_won,
    is_lost
  )
  VALUES (
    _funnel_id,
    'stage_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    _clean_name,
    _insert_position,
    null,
    false,
    false
  )
  RETURNING * INTO _result;

  RETURN _result;
END;
$$;

DROP POLICY IF EXISTS "Admins manage stages - insert" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Managers manage stages - insert" ON public.pipeline_stages;
CREATE POLICY "Managers manage stages - insert" ON public.pipeline_stages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_is_active()
    AND public.current_user_can_manage_team()
    AND public.current_user_has_funnel_access(funnel_id)
  );

REVOKE EXECUTE ON FUNCTION public.create_pipeline_stage(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pipeline_stage(uuid, text, uuid) TO authenticated;
