import type { Lead } from "@/types/crm";
import { formatCurrency } from "@/lib/constants";

type ValleContractOption = {
  code: string;
  label: string;
};

type ValleContractLeadLike = Pick<
  Lead,
  | "phone"
  | "email"
  | "contract_state_registration"
  | "contract_fiscal_code"
  | "contract_accounting_code"
  | "contract_labor_code"
  | "contract_financial_codes"
  | "contract_include_address"
  | "tax_regime"
  | "estimated_value"
>;

export const VALLE_CONTRACT_FISCAL_OPTIONS: ValleContractOption[] = [
  { code: "1.1", label: "Comercio no Simples Nacional" },
  { code: "1.2", label: "Comercio no Lucro Presumido ou Lucro Real" },
  { code: "1.3", label: "Prestadora de servicos no Simples Nacional" },
  { code: "1.4", label: "Prestadora de servicos ou Holding no Lucro Presumido ou Lucro Real" },
  { code: "1.5", label: "Loteadora, Incorporadora ou Locadora de Imoveis" },
  { code: "1.6", label: "Condominio, Associacao ou Pessoa Fisica equiparada a Juridica" },
] as const;

export const VALLE_CONTRACT_ACCOUNTING_OPTIONS: ValleContractOption[] = [
  { code: "2.1", label: "Empresa enquadrada no Simples Nacional" },
  { code: "2.2", label: "Empresa nao enquadrada no Simples Nacional" },
] as const;

export const VALLE_CONTRACT_LABOR_OPTIONS: ValleContractOption[] = [
  { code: "3.1", label: "Possui funcionarios" },
  { code: "3.2", label: "Sem funcionarios, mas com pro-labore dos socios" },
  { code: "3.3", label: "Folha nao sera processada pela M&G" },
] as const;

export const VALLE_CONTRACT_FINANCIAL_OPTIONS: ValleContractOption[] = [
  { code: "4.1", label: "Emissao de Notas Fiscais" },
  { code: "4.2", label: "Controle Financeiro" },
  { code: "4.3", label: "Tesouraria" },
  { code: "4.4", label: "Controladoria" },
] as const;

export const VALLE_CONTRACT_ADDRESS_OPTION: ValleContractOption = {
  code: "5",
  label: "Endereco Fiscal/Comercial",
};

const VALLE_CONTRACT_SERVICE_OPTIONS = [
  ...VALLE_CONTRACT_FISCAL_OPTIONS,
  ...VALLE_CONTRACT_ACCOUNTING_OPTIONS,
  ...VALLE_CONTRACT_LABOR_OPTIONS,
  ...VALLE_CONTRACT_FINANCIAL_OPTIONS,
  VALLE_CONTRACT_ADDRESS_OPTION,
] as const;

const valleContractLabelByCode = new Map(
  VALLE_CONTRACT_SERVICE_OPTIONS.map((option) => [option.code, option.label]),
);
const valleContractOrderByCode = new Map(
  VALLE_CONTRACT_SERVICE_OPTIONS.map((option, index) => [option.code, index]),
);

const normalizeOptionalString = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
};

const normalizeMonthlyFee = (value: number | string | null | undefined) => {
  const normalizedValue = Number(value ?? 0);
  if (Number.isNaN(normalizedValue) || normalizedValue <= 0) return "Nao informado";
  return formatCurrency(normalizedValue);
};

export const buildValleContractServiceCodes = (lead: ValleContractLeadLike) => {
  const codes: string[] = [];

  if (normalizeOptionalString(lead.contract_fiscal_code)) {
    codes.push(lead.contract_fiscal_code!.trim());
  }
  if (normalizeOptionalString(lead.contract_accounting_code)) {
    codes.push(lead.contract_accounting_code!.trim());
  }
  if (normalizeOptionalString(lead.contract_labor_code)) {
    codes.push(lead.contract_labor_code!.trim());
  }

  const financialCodes = Array.isArray(lead.contract_financial_codes)
    ? lead.contract_financial_codes
        .filter((code): code is string => typeof code === "string")
        .map((code) => code.trim())
        .filter(Boolean)
    : [];

  codes.push(...financialCodes);

  if (lead.contract_include_address) {
    codes.push(VALLE_CONTRACT_ADDRESS_OPTION.code);
  }

  return Array.from(new Set(codes)).sort(
    (left, right) =>
      (valleContractOrderByCode.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (valleContractOrderByCode.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
};

export const buildValleContractServiceLabels = (lead: ValleContractLeadLike) =>
  buildValleContractServiceCodes(lead).map((code) => ({
    code,
    label: valleContractLabelByCode.get(code) ?? code,
  }));

export const buildValleContractSummary = (lead: ValleContractLeadLike) => {
  const serviceCodes = buildValleContractServiceCodes(lead);

  return [
    `Regime Federal: ${normalizeOptionalString(lead.tax_regime) ?? "Nao informado"}`,
    `Telefone: ${normalizeOptionalString(lead.phone) ?? "Nao informado"}`,
    `E-mail: ${normalizeOptionalString(lead.email) ?? "Nao informado"}`,
    `Inscricao Estadual: ${normalizeOptionalString(lead.contract_state_registration) ?? "ISENTO"}`,
    `Topicos dos servicos contratados: ${serviceCodes.length > 0 ? serviceCodes.join(", ") : "Nao informado"}`,
    `Honorarios mensais: ${normalizeMonthlyFee(lead.estimated_value)}`,
  ].join("\n");
};

export const hasValleContractSelections = (lead: ValleContractLeadLike) =>
  Boolean(
    normalizeOptionalString(lead.contract_state_registration) ||
      normalizeOptionalString(lead.contract_fiscal_code) ||
      normalizeOptionalString(lead.contract_accounting_code) ||
      normalizeOptionalString(lead.contract_labor_code) ||
      (Array.isArray(lead.contract_financial_codes) && lead.contract_financial_codes.length > 0) ||
      lead.contract_include_address,
  );
