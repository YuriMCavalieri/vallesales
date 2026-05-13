CREATE INDEX IF NOT EXISTS leads_lost_auto_archive_idx
  ON public.leads (is_archived, lost_at)
  WHERE lost_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.archive_expired_terminal_leads()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated_count integer := 0;
BEGIN
  WITH archived_rows AS (
    UPDATE public.leads l
    SET is_archived = true,
        archived_at = COALESCE(l.archived_at, now()),
        archived_by = NULL
    FROM public.pipeline_stages ps
    WHERE ps.id = l.stage_id
      AND l.is_archived = false
      AND (
        (ps.is_won = true AND l.won_at IS NOT NULL AND l.won_at <= now() - interval '3 days')
        OR
        (ps.is_lost = true AND l.lost_at IS NOT NULL AND l.lost_at <= now() - interval '3 days')
      )
    RETURNING l.id, l.stage_id, l.won_at, l.lost_at, l.archived_at
  )
  INSERT INTO public.lead_activities (lead_id, type, description, metadata)
  SELECT
    archived_rows.id,
    'lead_updated',
    CASE
      WHEN ps.is_won THEN 'Negocio arquivado automaticamente apos 3 dias como cliente.'
      WHEN ps.is_lost THEN 'Negocio arquivado automaticamente apos 3 dias como perdido.'
      ELSE 'Negocio arquivado automaticamente.'
    END,
    jsonb_build_object(
      'mode',
      'auto_archive',
      'terminal_status',
      CASE
        WHEN ps.is_won THEN 'won'
        WHEN ps.is_lost THEN 'lost'
        ELSE 'unknown'
      END,
      'won_at',
      archived_rows.won_at,
      'lost_at',
      archived_rows.lost_at,
      'archived_at',
      archived_rows.archived_at
    )
  FROM archived_rows
  JOIN public.pipeline_stages ps ON ps.id = archived_rows.stage_id;

  GET DIAGNOSTICS _updated_count = ROW_COUNT;

  RETURN _updated_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_expired_terminal_leads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_expired_terminal_leads() TO authenticated, service_role;

SELECT public.archive_expired_terminal_leads();
