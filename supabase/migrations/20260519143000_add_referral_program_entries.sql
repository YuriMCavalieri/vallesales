CREATE TABLE IF NOT EXISTS public.referral_program_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  access_token text NOT NULL UNIQUE,
  referrer_name text NOT NULL,
  referrer_company text,
  referrer_email text,
  referrer_phone text,
  referred_contact_name text,
  referred_email text,
  reward_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_program_entries ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS referral_program_entries_updated_at ON public.referral_program_entries;
CREATE TRIGGER referral_program_entries_updated_at
BEFORE UPDATE ON public.referral_program_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS referral_program_entries_referrer_email_idx
  ON public.referral_program_entries (referrer_email);

CREATE INDEX IF NOT EXISTS referral_program_entries_created_at_idx
  ON public.referral_program_entries (created_at DESC);
