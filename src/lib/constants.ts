import { parseDateValue } from "@/lib/date";

export const TEMPERATURE_OPTIONS = [
  { value: "frio", label: "Frio", color: "bg-temp-frio" },
  { value: "morno", label: "Morno", color: "bg-temp-morno" },
  { value: "quente", label: "Quente", color: "bg-temp-quente" },
] as const;

export const CONTACT_METHOD_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ligacao", label: "Ligacao" },
  { value: "email", label: "E-mail" },
  { value: "reuniao", label: "Reuniao" },
  { value: "indicacao", label: "Indicacao" },
  { value: "outro", label: "Outro" },
] as const;

export const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR",
  "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export const SOURCE_OPTIONS = [
  "Site", "Indicacao", "LinkedIn", "Instagram", "Google Ads",
  "WhatsApp", "Evento", "E-mail marketing", "Outro",
];

export const formatCurrency = (value: number | null | undefined) => {
  const v = Number(value ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const formatDate = (date: string | null | undefined) => {
  if (!date) return "-";
  const parsed = parseDateValue(date);
  if (!parsed) return "-";
  return parsed.toLocaleDateString("pt-BR");
};

export const formatDateTime = (date: string | null | undefined) => {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};
