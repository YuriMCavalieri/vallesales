
-- 1) Novos valores de enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'consultor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'visualizador';

-- 2) Colunas em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_receive_leads boolean NOT NULL DEFAULT true;

-- 3) Garantir que perfis existentes fiquem ativos / podem receber leads
UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;
UPDATE public.profiles SET can_receive_leads = true WHERE can_receive_leads IS NULL;
