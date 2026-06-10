-- Campos especificos do resumo de contrato usado no funil Valle Consultores.

alter table public.leads
  add column if not exists contract_federal_regime text,
  add column if not exists contract_state_registration text,
  add column if not exists contract_monthly_fee text,
  add column if not exists contract_fiscal_code text,
  add column if not exists contract_accounting_code text,
  add column if not exists contract_labor_code text,
  add column if not exists contract_financial_codes text[] not null default '{}'::text[],
  add column if not exists contract_include_address boolean not null default false;

comment on column public.leads.contract_federal_regime is
  'Regime federal usado no resumo de contrato do funil Valle Consultores.';

comment on column public.leads.contract_state_registration is
  'Inscricao estadual informada para o contrato; se vazio, o resumo assume ISENTO.';

comment on column public.leads.contract_monthly_fee is
  'Honorarios mensais informados para o contrato.';

comment on column public.leads.contract_fiscal_code is
  'Codigo selecionado para o bloco 1 - Gestao Fiscal.';

comment on column public.leads.contract_accounting_code is
  'Codigo selecionado para o bloco 2 - Gestao Contabil.';

comment on column public.leads.contract_labor_code is
  'Codigo selecionado para o bloco 3 - Gestao Trabalhista.';

comment on column public.leads.contract_financial_codes is
  'Codigos selecionados para o bloco 4 - Gestao Financeira.';

comment on column public.leads.contract_include_address is
  'Indica se o contrato inclui o codigo 5 - Endereco Fiscal/Comercial.';
