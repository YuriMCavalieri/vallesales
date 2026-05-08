-- Permite excluir funis por admin e gestor com validacoes explicitas.

CREATE OR REPLACE FUNCTION public.delete_funnel(_funnel_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_default boolean;
  _lead_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_manage_team() THEN
    RAISE EXCEPTION 'Sem permissao para excluir funis.'
      USING ERRCODE = '42501';
  END IF;

  SELECT is_default
  INTO _is_default
  FROM public.funnels
  WHERE id = _funnel_id;

  IF _is_default IS NULL THEN
    RAISE EXCEPTION 'Funil nao encontrado.'
      USING ERRCODE = 'P0002';
  END IF;

  IF _is_default THEN
    RAISE EXCEPTION 'O funil principal nao pode ser excluido.'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*)
  INTO _lead_count
  FROM public.leads
  WHERE funnel_id = _funnel_id;

  IF _lead_count > 0 THEN
    RAISE EXCEPTION 'Nao e possivel excluir um funil que ainda possui leads vinculados.'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.funnels
  WHERE id = _funnel_id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_funnel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_funnel(uuid) TO authenticated;
