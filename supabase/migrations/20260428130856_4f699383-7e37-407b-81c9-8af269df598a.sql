-- Trigger: registrar automaticamente mudança de responsável do lead
CREATE OR REPLACE FUNCTION public.log_lead_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_owner_name TEXT;
  new_owner_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    SELECT COALESCE(full_name, email) INTO old_owner_name FROM public.profiles WHERE id = OLD.owner_id;
    SELECT COALESCE(full_name, email) INTO new_owner_name FROM public.profiles WHERE id = NEW.owner_id;
    INSERT INTO public.lead_activities (lead_id, type, description, metadata, created_by)
    VALUES (
      NEW.id,
      'owner_change',
      'Responsável alterado de "' || COALESCE(old_owner_name, 'sem responsável') || '" para "' || COALESCE(new_owner_name, 'sem responsável') || '"',
      jsonb_build_object('from', OLD.owner_id, 'to', NEW.owner_id),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Garante triggers ativos para criação, mudança de etapa e mudança de responsável
DROP TRIGGER IF EXISTS trg_log_lead_created ON public.leads;
CREATE TRIGGER trg_log_lead_created
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_created();

DROP TRIGGER IF EXISTS trg_log_lead_stage_change ON public.leads;
CREATE TRIGGER trg_log_lead_stage_change
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_stage_change();

DROP TRIGGER IF EXISTS trg_log_lead_owner_change ON public.leads;
CREATE TRIGGER trg_log_lead_owner_change
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_owner_change();

-- Trigger para manter updated_at automaticamente
DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();