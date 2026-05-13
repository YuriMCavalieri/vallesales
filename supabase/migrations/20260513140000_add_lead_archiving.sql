ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at timestamptz,
ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS won_at timestamptz,
ADD COLUMN IF NOT EXISTS lost_at timestamptz,
ADD COLUMN IF NOT EXISTS last_active_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_archived_funnel_idx
  ON public.leads (is_archived, funnel_id, stage_id);

CREATE INDEX IF NOT EXISTS leads_won_auto_archive_idx
  ON public.leads (is_archived, won_at)
  WHERE won_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_lead_archival_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _new_stage public.pipeline_stages%ROWTYPE;
  _old_stage public.pipeline_stages%ROWTYPE;
  _new_is_won boolean := false;
  _new_is_lost boolean := false;
  _old_is_won boolean := false;
  _old_is_lost boolean := false;
BEGIN
  IF NEW.stage_id IS NOT NULL THEN
    SELECT *
    INTO _new_stage
    FROM public.pipeline_stages
    WHERE id = NEW.stage_id
    LIMIT 1;

    _new_is_won := COALESCE(_new_stage.is_won, false);
    _new_is_lost := COALESCE(_new_stage.is_lost, false);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.stage_id IS NOT NULL THEN
    SELECT *
    INTO _old_stage
    FROM public.pipeline_stages
    WHERE id = OLD.stage_id
    LIMIT 1;

    _old_is_won := COALESCE(_old_stage.is_won, false);
    _old_is_lost := COALESCE(_old_stage.is_lost, false);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT (_new_is_won OR _new_is_lost) THEN
      NEW.last_active_stage_id := COALESCE(NEW.last_active_stage_id, NEW.stage_id);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    IF NOT (_old_is_won OR _old_is_lost) THEN
      NEW.last_active_stage_id := OLD.stage_id;
    END IF;
  END IF;

  IF _new_is_won THEN
    IF TG_OP = 'INSERT' THEN
      NEW.won_at := COALESCE(NEW.won_at, now());
    ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id OR OLD.won_at IS NULL THEN
      NEW.won_at := COALESCE(NEW.won_at, now());
    END IF;
    NEW.lost_at := NULL;
  ELSIF _new_is_lost THEN
    IF TG_OP = 'INSERT' THEN
      NEW.lost_at := COALESCE(NEW.lost_at, now());
    ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id OR OLD.lost_at IS NULL THEN
      NEW.lost_at := COALESCE(NEW.lost_at, now());
    END IF;
    NEW.won_at := NULL;
  ELSE
    NEW.won_at := NULL;
    NEW.lost_at := NULL;
    NEW.is_archived := false;
    NEW.archived_at := NULL;
    NEW.archived_by := NULL;
    NEW.last_active_stage_id := COALESCE(NEW.stage_id, NEW.last_active_stage_id);
  END IF;

  IF COALESCE(NEW.is_archived, false) THEN
    NEW.archived_at := COALESCE(NEW.archived_at, now());
  ELSE
    NEW.archived_at := NULL;
    NEW.archived_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_archival_state ON public.leads;
CREATE TRIGGER trg_sync_lead_archival_state
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.sync_lead_archival_state();

UPDATE public.leads l
SET last_active_stage_id = l.stage_id
FROM public.pipeline_stages ps
WHERE ps.id = l.stage_id
  AND ps.is_won = false
  AND ps.is_lost = false
  AND l.last_active_stage_id IS NULL;

UPDATE public.leads l
SET won_at = COALESCE(l.won_at, l.updated_at, l.created_at),
    lost_at = NULL
FROM public.pipeline_stages ps
WHERE ps.id = l.stage_id
  AND ps.is_won = true
  AND l.won_at IS NULL;

UPDATE public.leads l
SET lost_at = COALESCE(l.lost_at, l.updated_at, l.created_at),
    won_at = NULL
FROM public.pipeline_stages ps
WHERE ps.id = l.stage_id
  AND ps.is_lost = true
  AND l.lost_at IS NULL;

CREATE OR REPLACE FUNCTION public.archive_expired_terminal_leads()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated_count integer := 0;
BEGIN
  UPDATE public.leads l
  SET is_archived = true,
      archived_at = COALESCE(l.archived_at, now()),
      archived_by = NULL
  FROM public.pipeline_stages ps
  WHERE ps.id = l.stage_id
    AND ps.is_won = true
    AND l.is_archived = false
    AND l.won_at IS NOT NULL
    AND l.won_at <= now() - interval '3 days';

  GET DIAGNOSTICS _updated_count = ROW_COUNT;

  IF _updated_count > 0 THEN
    INSERT INTO public.lead_activities (lead_id, type, description, metadata)
    SELECT
      l.id,
      'lead_updated',
      'Negocio arquivado automaticamente apos 3 dias como cliente.',
      jsonb_build_object('mode', 'auto_archive', 'won_at', l.won_at, 'archived_at', l.archived_at)
    FROM public.leads l
    JOIN public.pipeline_stages ps ON ps.id = l.stage_id
    WHERE ps.is_won = true
      AND l.is_archived = true
      AND l.archived_by IS NULL
      AND l.archived_at >= now() - interval '1 minute';
  END IF;

  RETURN _updated_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_expired_terminal_leads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_expired_terminal_leads() TO authenticated, service_role;

SELECT public.archive_expired_terminal_leads();

DO $$
DECLARE
  _job_id bigint;
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron indisponivel neste ambiente; o autoarquivamento seguira via backend.';
  END;

  BEGIN
    SELECT jobid
    INTO _job_id
    FROM cron.job
    WHERE jobname = 'archive-expired-crm-leads'
    LIMIT 1;

    IF _job_id IS NOT NULL THEN
      PERFORM cron.unschedule(_job_id);
    END IF;

    PERFORM cron.schedule(
      'archive-expired-crm-leads',
      '15 * * * *',
      $cron$SELECT public.archive_expired_terminal_leads();$cron$
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Agendamento via pg_cron nao configurado; mantendo fallback pelo backend.';
  END;
END;
$$;
