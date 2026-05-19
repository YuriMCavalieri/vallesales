import html2canvas from "html2canvas";
import type { Lead, PipelineStage, Profile } from "@/types/crm";
import { CONTACT_METHOD_OPTIONS, formatCurrency, formatDate, formatDateTime } from "@/lib/constants";
import { COMPANY_MATURITY_LABELS, parseAdditionalContacts, parseLeadSource } from "@/lib/lead-form";
import cwkLogoUrl from "@/assets/cwk-logo-full.png";
import valleLogoUrl from "@/assets/valle-logo-full.png";

export type ExportBrand = "valle" | "cwk";

type LeadExportContext = {
  lead: Lead;
  funnelName?: string | null;
  stageName?: string | null;
  ownerName?: string | null;
};

type LeadExportRow = {
  label: string;
  value: string;
};

type LeadExportSection = {
  title: string;
  rows: LeadExportRow[];
};

type LeadExportTheme = {
  brand: ExportBrand;
  brandLabel: string;
  title: string;
  primary: string;
  secondary: string;
  accent: string;
  soft: string;
  surface: string;
  text: string;
  muted: string;
  logoUrl: string;
};

type FunnelExportContext = {
  leads: Lead[];
  stages: PipelineStage[];
  profiles: Profile[];
  funnelName?: string | null;
  funnelNameById?: Map<string, string>;
  fileBaseName?: string | null;
  workbookTitle?: string;
};

type DashboardExportContext = {
  element: HTMLElement;
  funnelName?: string | null;
  title: string;
  subtitle?: string;
  fileBaseName?: string | null;
};

const contactMethodLabelByValue = Object.fromEntries(
  CONTACT_METHOD_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>;

const themes: Record<ExportBrand, LeadExportTheme> = {
  valle: {
    brand: "valle",
    brandLabel: "Valle Sales",
    title: "Ficha cadastral do lead",
    primary: "#2B3C46",
    secondary: "#49616C",
    accent: "#B78362",
    soft: "#F4EFEB",
    surface: "#FFFFFF",
    text: "#1F2937",
    muted: "#6B7280",
    logoUrl: valleLogoUrl,
  },
  cwk: {
    brand: "cwk",
    brandLabel: "CWK Coworking",
    title: "Ficha cadastral CWK",
    primary: "#4F2878",
    secondary: "#5E3187",
    accent: "#FF7F2A",
    soft: "#F7F0FF",
    surface: "#FFFFFF",
    text: "#231B2E",
    muted: "#6C6480",
    logoUrl: cwkLogoUrl,
  },
};

const assetDataUrlCache = new Map<string, Promise<string>>();

const normalizeTextKey = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const isFilled = (value: string | null | undefined) => Boolean(value && value.trim());

const toDisplayValue = (value: string | null | undefined, fallback = "Não informado") =>
  isFilled(value) ? value!.trim() : fallback;

const toYesNo = (value: boolean) => (value ? "Sim" : "Não");

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const safeHex = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;

  const intValue = Number.parseInt(safeHex, 16);

  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
};

const readBlobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const loadAssetDataUrl = (assetUrl: string) => {
  const cached = assetDataUrlCache.get(assetUrl);
  if (cached) return cached;

  const promise = fetch(assetUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Falha ao carregar asset: ${assetUrl}`);
      }
      return response.blob();
    })
    .then(readBlobAsDataUrl);

  assetDataUrlCache.set(assetUrl, promise);
  return promise;
};

const inferBrandFromFunnelName = (funnelName: string | null | undefined): ExportBrand =>
  normalizeTextKey(funnelName).startsWith("cwk") ? "cwk" : "valle";

const inferBrandFromLead = ({ lead, funnelName }: LeadExportContext): ExportBrand => {
  const funnelKey = normalizeTextKey(funnelName);
  const sourceKey = normalizeTextKey(lead.source);
  const serviceKeys = (lead.service_types ?? []).map(normalizeTextKey);

  if (
    funnelKey.startsWith("cwk") ||
    sourceKey.includes("cwk") ||
    serviceKeys.some((serviceKey) => serviceKey.includes("coworking"))
  ) {
    return "cwk";
  }

  return "valle";
};

const formatContactMethod = (value: Lead["contact_method"]) => {
  if (!value) return "Não informado";
  return contactMethodLabelByValue[value] ?? value;
};

const formatCompanyMaturity = (value: string | null) => {
  if (!value) return "Não informado";
  if (value in COMPANY_MATURITY_LABELS) {
    return COMPANY_MATURITY_LABELS[value as keyof typeof COMPANY_MATURITY_LABELS];
  }
  return value;
};

const formatSource = (value: string | null | undefined) => {
  const sourceState = parseLeadSource(value);
  if (!sourceState.source) return "Não informado";
  if (sourceState.indication_by) {
    return `${sourceState.source} • ${sourceState.indication_by}`;
  }
  return sourceState.source;
};

const formatStatus = (lead: Lead) => {
  if (lead.is_archived) return "Arquivado";
  if (lead.lost_at) return "Perdido";
  if (lead.won_at) return "Fechado";
  return "Ativo";
};

const formatNumberLikeValue = (value: string | null | undefined) => {
  if (!isFilled(value)) return "Não informado";
  return value!.trim();
};

const formatEstimatedValue = (value: number | null) =>
  value && value > 0 ? formatCurrency(value) : "Não informado";

const resolveThemeByBrand = (brand: ExportBrand) => themes[brand];

const resolveStageName = (stages: PipelineStage[], lead: Lead) =>
  stages.find((stage) => stage.id === lead.stage_id)?.name ?? "";

const resolveOwnerName = (profiles: Profile[], lead: Lead) => {
  const owner = profiles.find((profile) => profile.id === lead.owner_id);
  return owner?.full_name || owner?.email || "";
};

const buildLeadSections = (context: LeadExportContext) => {
  const { lead, funnelName, ownerName, stageName } = context;
  const additionalContacts = parseAdditionalContacts(lead.additional_contacts);

  const sections: LeadExportSection[] = [
    {
      title: "Resumo do lead",
      rows: [
        { label: "Empresa / pessoa", value: toDisplayValue(lead.company_or_person, "Sem nome") },
        { label: "Contato principal", value: toDisplayValue(lead.contact_name) },
        { label: "Negócio / funil", value: toDisplayValue(funnelName) },
        { label: "Etapa atual", value: toDisplayValue(stageName) },
        { label: "Responsável", value: toDisplayValue(ownerName) },
        { label: "Status", value: formatStatus(lead) },
        { label: "Temperatura", value: toDisplayValue(lead.temperature) },
        { label: "Origem", value: formatSource(lead.source) },
        { label: "Data de cadastro", value: formatDateTime(lead.created_at) },
        { label: "Última atualização", value: formatDateTime(lead.updated_at) },
      ],
    },
    {
      title: "Contato e localização",
      rows: [
        { label: "Telefone", value: toDisplayValue(lead.phone) },
        { label: "E-mail", value: toDisplayValue(lead.email) },
        { label: "CNPJ", value: toDisplayValue(lead.cnpj) },
        { label: "Cidade", value: toDisplayValue(lead.city) },
        { label: "UF", value: toDisplayValue(lead.uf) },
        { label: "Próximo follow-up", value: formatDate(lead.next_follow_up) },
        { label: "Método de contato", value: formatContactMethod(lead.contact_method) },
        { label: "Contato já realizado", value: toYesNo(lead.has_been_contacted) },
      ],
    },
    {
      title: "Serviços e enquadramento",
      rows: [
        { label: "Perfil da empresa", value: formatCompanyMaturity(lead.company_maturity) },
        { label: "Serviços", value: lead.service_types.length > 0 ? lead.service_types.join(", ") : "Não informado" },
        { label: "Detalhes dos serviços", value: toDisplayValue(lead.service_details) },
        { label: "Segmento", value: toDisplayValue(lead.segment) },
        { label: "Segmento complementar", value: toDisplayValue(lead.segment_other) },
        { label: "Regime tributário", value: toDisplayValue(lead.tax_regime) },
        { label: "Valor estimado", value: formatEstimatedValue(lead.estimated_value) },
      ],
    },
    {
      title: "Dados operacionais",
      rows: [
        { label: "Total de colaboradores", value: formatNumberLikeValue(lead.employee_count) },
        { label: "Funcionários CLT", value: formatNumberLikeValue(lead.employee_count_clt) },
        { label: "Profissionais PJ", value: formatNumberLikeValue(lead.employee_count_pj) },
        { label: "Faturamento gerencial", value: formatNumberLikeValue(lead.monthly_revenue_managerial) },
        { label: "Faturamento fiscal", value: formatNumberLikeValue(lead.monthly_revenue_fiscal) },
        { label: "Notas fiscais por mês", value: formatNumberLikeValue(lead.monthly_invoice_count) },
        { label: "Folha bruta mensal", value: formatNumberLikeValue(lead.payroll_gross_value) },
        { label: "Contas bancárias", value: formatNumberLikeValue(lead.bank_account_count) },
        { label: "Contas separadas por centro de custo", value: toDisplayValue(lead.bank_accounts_split) },
        { label: "Sistema financeiro", value: toDisplayValue(lead.financial_system) },
      ],
    },
    {
      title: "Observações e contexto",
      rows: [
        { label: "Dores contábeis", value: toDisplayValue(lead.accounting_pain_points) },
        { label: "Observações internas", value: toDisplayValue(lead.notes) },
        { label: "Motivo da perda", value: toDisplayValue(lead.loss_reason) },
      ],
    },
  ];

  return {
    sections: sections
      .map((section) => ({
        ...section,
        rows: section.rows.filter((row) => isFilled(row.value) && row.value !== "Não informado"),
      }))
      .filter((section) => section.rows.length > 0),
    additionalContacts,
  };
};

const buildFileBaseName = (parts: Array<string | null | undefined>) =>
  parts
    .filter(Boolean)
    .join("-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const drawLogoBadge = async (
  doc: import("jspdf").jsPDF,
  theme: LeadExportTheme,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const soft = hexToRgb(theme.soft);
  const logoDataUrl = await loadAssetDataUrl(theme.logoUrl);
  const paddingX = 6;
  const paddingY = 6;
  const imageAreaWidth = width - paddingX * 2;
  const imageAreaHeight = height - paddingY * 2;
  const imageProps = doc.getImageProperties(logoDataUrl);
  const imageRatio = imageProps.width / imageProps.height;
  const areaRatio = imageAreaWidth / imageAreaHeight;

  let drawWidth = imageAreaWidth;
  let drawHeight = imageAreaHeight;

  if (imageRatio > areaRatio) {
    drawHeight = drawWidth / imageRatio;
  } else {
    drawWidth = drawHeight * imageRatio;
  }

  const imageX = x + paddingX + (imageAreaWidth - drawWidth) / 2;
  const imageY = y + paddingY + (imageAreaHeight - drawHeight) / 2;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, height, 16, 16, "F");
  doc.setDrawColor(soft.r, soft.g, soft.b);
  doc.roundedRect(x, y, width, height, 16, 16, "S");
  doc.addImage(
    logoDataUrl,
    "PNG",
    imageX,
    imageY,
    drawWidth,
    drawHeight,
    undefined,
    "FAST",
  );
};

const resolveHeaderTitleLayout = (
  doc: import("jspdf").jsPDF,
  title: string,
  maxWidth: number,
  options?: {
    maxLines?: number;
    preferredFontSize?: number;
    minimumFontSize?: number;
    lineHeightRatio?: number;
  },
) => {
  const maxLines = options?.maxLines ?? 3;
  const preferredFontSize = options?.preferredFontSize ?? 24;
  const minimumFontSize = options?.minimumFontSize ?? 18;
  const lineHeightRatio = options?.lineHeightRatio ?? 1.1;

  let fontSize = preferredFontSize;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  let lines = doc.splitTextToSize(title, maxWidth) as string[];

  while (fontSize > minimumFontSize && lines.length > maxLines) {
    fontSize -= 1;
    doc.setFontSize(fontSize);
    lines = doc.splitTextToSize(title, maxWidth) as string[];
  }

  return {
    fontSize,
    lineHeight: Math.round(fontSize * lineHeightRatio),
    lines,
  };
};

const drawSectionCard = (
  doc: import("jspdf").jsPDF,
  theme: LeadExportTheme,
  section: LeadExportSection,
  pageWidth: number,
  pageHeight: number,
  initialY: number,
) => {
  const marginX = 24;
  const cardWidth = pageWidth - marginX * 2;
  const cardPadding = 16;
  const labelWidth = 150;
  const contentWidth = cardWidth - cardPadding * 2 - labelWidth - 12;
  const rgbPrimary = hexToRgb(theme.primary);
  const rgbSoft = hexToRgb(theme.soft);
  const rgbText = hexToRgb(theme.text);
  const rgbMuted = hexToRgb(theme.muted);

  let y = initialY;

  const ensureSpace = (requiredHeight: number) => {
    if (y + requiredHeight <= pageHeight - 28) return;
    doc.addPage();
    y = 32;
  };

  const titleHeight = 26;
  ensureSpace(titleHeight + 12);

  doc.setFillColor(rgbSoft.r, rgbSoft.g, rgbSoft.b);
  doc.roundedRect(marginX, y, cardWidth, titleHeight, 10, 10, "F");
  doc.setFillColor(rgbPrimary.r, rgbPrimary.g, rgbPrimary.b);
  doc.roundedRect(marginX, y, 6, titleHeight, 10, 10, "F");
  doc.setTextColor(rgbPrimary.r, rgbPrimary.g, rgbPrimary.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(section.title, marginX + 18, y + 17);
  y += titleHeight + 10;

  section.rows.forEach((row) => {
    const labelLines = doc.splitTextToSize(row.label, labelWidth);
    const valueLines = doc.splitTextToSize(row.value, contentWidth);
    const contentHeight = Math.max(labelLines.length, valueLines.length) * 12 + 18;

    ensureSpace(contentHeight + 8);

    doc.setDrawColor(232, 236, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(marginX, y, cardWidth, contentHeight, 10, 10, "FD");

    doc.setTextColor(rgbMuted.r, rgbMuted.g, rgbMuted.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(labelLines, marginX + cardPadding, y + 14, { baseline: "top" });

    doc.setTextColor(rgbText.r, rgbText.g, rgbText.b);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(valueLines, marginX + cardPadding + labelWidth + 12, y + 14, { baseline: "top" });

    y += contentHeight + 8;
  });

  return y + 4;
};

const applyPdfFooter = (
  doc: import("jspdf").jsPDF,
  theme: LeadExportTheme,
  extraRightText: string,
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const muted = hexToRgb(theme.muted);
  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(230, 233, 238);
    doc.line(24, pageHeight - 24, pageWidth - 24, pageHeight - 24);
    doc.setTextColor(muted.r, muted.g, muted.b);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${theme.brandLabel} • Página ${page} de ${totalPages}`, 24, pageHeight - 10);
    doc.text(extraRightText, pageWidth - 24, pageHeight - 10, { align: "right" });
  }
};

const buildLeadWorkbook = async (context: FunnelExportContext) => {
  const XLSX = await import("xlsx");

  const stageById = new Map(context.stages.map((stage) => [stage.id, stage]));
  const profileById = new Map(context.profiles.map((profile) => [profile.id, profile]));

  const leadRows = context.leads.map((lead) => {
    const stage = stageById.get(lead.stage_id);
    const owner = lead.owner_id ? profileById.get(lead.owner_id) : null;
    const leadFunnelName = context.funnelNameById?.get(lead.funnel_id) ?? context.funnelName ?? "";

    return {
      "Negócio - Título": lead.company_or_person,
      "Negócio - Valor": lead.estimated_value ? Number(lead.estimated_value) : "",
      "Negócio - Funil": leadFunnelName,
      "Negócio - Etapa": stage?.name ?? "",
      "Negócio - Status": formatStatus(lead),
      "Negócio - Temperatura": lead.temperature,
      "Negócio - Origem": formatSource(lead.source),
      "Negócio - Serviços": lead.service_types.join(", "),
      "Negócio - Detalhes dos serviços": lead.service_details ?? "",
      "Negócio - Próximo follow-up": formatDate(lead.next_follow_up),
      "Negócio - Contato realizado": toYesNo(lead.has_been_contacted),
      "Negócio - Método de contato": formatContactMethod(lead.contact_method),
      "Negócio - Criado em": formatDateTime(lead.created_at),
      "Negócio - Atualizado em": formatDateTime(lead.updated_at),
      "Negócio - Observações": lead.notes ?? "",
      "Negócio - Motivo da perda": lead.loss_reason ?? "",
      "Pessoa - Nome": lead.contact_name ?? "",
      "Pessoa - E-mail": lead.email ?? "",
      "Pessoa - Telefone": lead.phone ?? "",
      "Responsável - Nome": owner?.full_name || owner?.email || "",
      "Empresa - CNPJ": lead.cnpj ?? "",
      "Empresa - Cidade": lead.city ?? "",
      "Empresa - UF": lead.uf ?? "",
      "Empresa - Perfil": formatCompanyMaturity(lead.company_maturity),
      "Empresa - Segmento": lead.segment ?? "",
      "Empresa - Segmento complementar": lead.segment_other ?? "",
      "Empresa - Regime tributário": lead.tax_regime ?? "",
      "Operação - Funcionários CLT": lead.employee_count_clt ?? "",
      "Operação - Profissionais PJ": lead.employee_count_pj ?? "",
      "Operação - Total de colaboradores": lead.employee_count ?? "",
      "Operação - Faturamento gerencial": lead.monthly_revenue_managerial ?? "",
      "Operação - Faturamento fiscal": lead.monthly_revenue_fiscal ?? "",
      "Operação - NF por mês": lead.monthly_invoice_count ?? "",
      "Operação - Folha bruta": lead.payroll_gross_value ?? "",
      "Operação - Contas bancárias": lead.bank_account_count ?? "",
      "Operação - Centro de custo separado": lead.bank_accounts_split ?? "",
      "Operação - Sistema financeiro": lead.financial_system ?? "",
      "Operação - Dores contábeis": lead.accounting_pain_points ?? "",
    };
  });

  const contactRows = context.leads.flatMap((lead) => {
    const stage = stageById.get(lead.stage_id);
    const leadFunnelName = context.funnelNameById?.get(lead.funnel_id) ?? context.funnelName ?? "";
    return parseAdditionalContacts(lead.additional_contacts).map((contact) => ({
      "Negócio - Título": lead.company_or_person,
      "Negócio - Funil": leadFunnelName,
      "Negócio - Etapa": stage?.name ?? "",
      "Contato - Nome": contact.name,
      "Contato - Telefone": contact.phone,
      "Contato - E-mail": contact.email,
    }));
  });

  const workbook = XLSX.utils.book_new();
  const leadSheet = XLSX.utils.json_to_sheet(leadRows);
  leadSheet["!cols"] = [
    { wch: 28 },
    { wch: 16 },
    { wch: 24 },
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 28 },
    { wch: 42 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 42 },
    { wch: 34 },
    { wch: 22 },
    { wch: 28 },
    { wch: 20 },
    { wch: 24 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 24 },
    { wch: 28 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 24 },
    { wch: 42 },
  ];
  XLSX.utils.book_append_sheet(workbook, leadSheet, context.workbookTitle || "Funil");

  const contactsSheet = XLSX.utils.json_to_sheet(contactRows.length > 0 ? contactRows : [{
    "Negócio - Título": "",
    "Negócio - Funil": "",
    "Negócio - Etapa": "",
    "Contato - Nome": "",
    "Contato - Telefone": "",
    "Contato - E-mail": "",
  }]);
  contactsSheet["!cols"] = [
    { wch: 28 },
    { wch: 24 },
    { wch: 22 },
    { wch: 26 },
    { wch: 20 },
    { wch: 32 },
  ];
  XLSX.utils.book_append_sheet(workbook, contactsSheet, "Contatos");

  return {
    XLSX,
    workbook,
  };
};

export const exportLeadAsPdf = async (context: LeadExportContext) => {
  const [{ jsPDF }] = await Promise.all([import("jspdf")]);
  const brand = inferBrandFromLead(context);
  const theme = resolveThemeByBrand(brand);
  const { sections, additionalContacts } = buildLeadSections(context);
  const fileBaseName = buildFileBaseName([
    context.lead.company_or_person,
    context.funnelName,
    brand,
    new Date().toISOString().slice(0, 10),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(theme.primary);
  const secondary = hexToRgb(theme.secondary);
  const accent = hexToRgb(theme.accent);
  const soft = hexToRgb(theme.soft);
  const muted = hexToRgb(theme.muted);
  const headerCardX = 24;
  const headerCardY = 20;
  const headerCardWidth = pageWidth - 48;
  const logoX = 36;
  const logoY = 30;
  const logoWidth = 184;
  const logoHeight = 72;
  const textX = logoX + logoWidth + 22;
  const textMaxWidth = headerCardX + headerCardWidth - textX - 20;
  const titleLayout = resolveHeaderTitleLayout(doc, context.lead.company_or_person, textMaxWidth, {
    preferredFontSize: 24,
    minimumFontSize: 18,
  });
  const titleLines = titleLayout.lines;
  const subtitleLines = doc.splitTextToSize(
    `${theme.title} • Exportado em ${new Date().toLocaleString("pt-BR")}`,
    textMaxWidth,
  );
  const titleFontSize = titleLayout.fontSize;
  const titleLineHeight = titleLayout.lineHeight;
  const subtitleLineHeight = 14;
  const textBlockHeight =
    titleLines.length * titleLineHeight +
    subtitleLines.length * subtitleLineHeight +
    10;
  const headerCardHeight = Math.max(112, Math.max(logoHeight, textBlockHeight) + 36);
  const headerHeight = headerCardY + headerCardHeight + 24;
  const textTop = headerCardY + 18;
  const subtitleTop = textTop + titleLines.length * titleLineHeight + 8;

  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageWidth, 6, "F");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(headerCardX, headerCardY, headerCardWidth, headerCardHeight, 18, 18, "F");

  await drawLogoBadge(doc, theme, logoX, logoY, logoWidth, logoHeight);

  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleFontSize);
  doc.text(titleLines, textX, textTop, { baseline: "top" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(secondary.r, secondary.g, secondary.b);
  doc.text(subtitleLines, textX, subtitleTop, { baseline: "top" });
  if (false) doc.text(
    `${theme.title} • Exportado em ${new Date().toLocaleString("pt-BR")}`,
    222,
    84,
    { maxWidth: pageWidth - 262 },
  );

  const summaryPills = [
    { label: "Funil", value: context.funnelName ?? "Não informado" },
    { label: "Etapa", value: context.stageName ?? "Não informada" },
    { label: "Responsável", value: context.ownerName ?? "Não informado" },
    { label: "Temperatura", value: context.lead.temperature },
  ];

  let pillX = 24;
  let pillY = headerHeight + 14;
  summaryPills.forEach((pill) => {
    const textValue = `${pill.label}: ${pill.value}`;
    const pillWidth = Math.min(doc.getTextWidth(textValue) + 22, pageWidth - 48);
    if (pillX + pillWidth > pageWidth - 24) {
      pillX = 24;
      pillY += 32;
    }

    doc.setFillColor(soft.r, soft.g, soft.b);
    doc.roundedRect(pillX, pillY, pillWidth, 22, 11, 11, "F");
    doc.setTextColor(secondary.r, secondary.g, secondary.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(textValue, pillX + 11, pillY + 14);
    pillX += pillWidth + 8;
  });

  let y = pillY + 40;
  sections.forEach((section) => {
    y = drawSectionCard(doc, theme, section, pageWidth, pageHeight, y);
  });

  if (additionalContacts.length > 0) {
    const extraSection: LeadExportSection = {
      title: "Contatos adicionais",
      rows: additionalContacts.map((contact) => ({
        label: contact.name || "Contato adicional",
        value: [
          contact.phone ? `Telefone: ${contact.phone}` : null,
          contact.email ? `E-mail: ${contact.email}` : null,
        ].filter(Boolean).join("\n"),
      })),
    };
    y = drawSectionCard(doc, theme, extraSection, pageWidth, pageHeight, y);
  }

  applyPdfFooter(doc, theme, `Lead ID: ${context.lead.id}`);
  doc.save(`${fileBaseName}.pdf`);
};

export const exportLeadAsExcel = async (context: LeadExportContext) => {
  const stageName = context.stageName ?? "";
  const ownerName = context.ownerName ?? "";
  const workbookData = await buildLeadWorkbook({
    leads: [context.lead],
    stages: stageName ? [{ id: context.lead.stage_id, name: stageName } as PipelineStage] : [],
    profiles: ownerName ? [{ id: context.lead.owner_id ?? "", full_name: ownerName, email: ownerName } as Profile] : [],
    funnelName: context.funnelName,
    fileBaseName: buildFileBaseName([
      context.lead.company_or_person,
      context.funnelName,
      "lead",
      new Date().toISOString().slice(0, 10),
    ]),
    workbookTitle: "Ficha",
  });

  const fileBaseName = buildFileBaseName([
    context.lead.company_or_person,
    context.funnelName,
    "lead",
    new Date().toISOString().slice(0, 10),
  ]);
  workbookData.XLSX.writeFile(workbookData.workbook, `${fileBaseName}.xlsx`);
};

export const exportFunnelAsExcel = async (context: FunnelExportContext) => {
  const workbookData = await buildLeadWorkbook(context);
  const fileBaseName = context.fileBaseName || buildFileBaseName([
    context.funnelName || "funil",
    "leads",
    new Date().toISOString().slice(0, 10),
  ]);

  workbookData.XLSX.writeFile(workbookData.workbook, `${fileBaseName}.xlsx`);
};

export const exportArchivedAsExcel = async (context: FunnelExportContext) => {
  const workbookData = await buildLeadWorkbook({
    ...context,
    workbookTitle: "Arquivados",
  });
  const fileBaseName = context.fileBaseName || buildFileBaseName([
    context.funnelName || "arquivados",
    "arquivados",
    new Date().toISOString().slice(0, 10),
  ]);

  workbookData.XLSX.writeFile(workbookData.workbook, `${fileBaseName}.xlsx`);
};

export const exportDashboardAsPdf = async (context: DashboardExportContext) => {
  const [{ jsPDF }] = await Promise.all([import("jspdf")]);
  const brand = inferBrandFromFunnelName(context.funnelName);
  const theme = resolveThemeByBrand(brand);
  const pageDoc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pageDoc.internal.pageSize.getWidth();
  const pageHeight = pageDoc.internal.pageSize.getHeight();
  const primary = hexToRgb(theme.primary);
  const secondary = hexToRgb(theme.secondary);
  const accent = hexToRgb(theme.accent);
  const muted = hexToRgb(theme.muted);
  const headerCardX = 24;
  const headerCardY = 20;
  const headerCardWidth = pageWidth - 48;
  const logoX = 36;
  const logoY = 30;
  const logoWidth = 184;
  const logoHeight = 72;
  const textX = logoX + logoWidth + 22;
  const textMaxWidth = headerCardX + headerCardWidth - textX - 20;
  const titleLayout = resolveHeaderTitleLayout(pageDoc, context.title, textMaxWidth, {
    preferredFontSize: 22,
    minimumFontSize: 17,
  });
  const titleLines = titleLayout.lines;
  const subtitleLines = pageDoc.splitTextToSize(
    context.subtitle || `Exportado em ${new Date().toLocaleString("pt-BR")}`,
    textMaxWidth,
  );
  const titleFontSize = titleLayout.fontSize;
  const titleLineHeight = titleLayout.lineHeight;
  const subtitleLineHeight = 14;
  const textBlockHeight =
    titleLines.length * titleLineHeight +
    subtitleLines.length * subtitleLineHeight +
    10;
  const headerCardHeight = Math.max(112, Math.max(logoHeight, textBlockHeight) + 36);
  const headerHeight = headerCardY + headerCardHeight + 22;
  const contentStartY = headerHeight + 20;

  const canvas = await html2canvas(context.element, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    scrollX: 0,
    scrollY: -window.scrollY,
    windowWidth: context.element.scrollWidth,
    windowHeight: context.element.scrollHeight,
  });

  const imageData = canvas.toDataURL("image/png");
  const marginX = 24;
  const availableWidth = pageWidth - marginX * 2;
  const imageHeight = (canvas.height * availableWidth) / canvas.width;
  const pageContentHeight = pageHeight - contentStartY - 28;

  const drawDashboardHeader = async () => {
    pageDoc.setFillColor(primary.r, primary.g, primary.b);
    pageDoc.rect(0, 0, pageWidth, headerHeight, "F");
    pageDoc.setFillColor(accent.r, accent.g, accent.b);
    pageDoc.rect(0, 0, pageWidth, 6, "F");
    pageDoc.setFillColor(255, 255, 255);
    pageDoc.roundedRect(headerCardX, headerCardY, headerCardWidth, headerCardHeight, 18, 18, "F");

    await drawLogoBadge(pageDoc, theme, logoX, logoY, logoWidth, logoHeight);

    pageDoc.setTextColor(primary.r, primary.g, primary.b);
    pageDoc.setFont("helvetica", "bold");
    pageDoc.setFontSize(titleFontSize);
    pageDoc.text(titleLines, textX, headerCardY + 18, { baseline: "top" });

    pageDoc.setTextColor(secondary.r, secondary.g, secondary.b);
    pageDoc.setFont("helvetica", "normal");
    pageDoc.setFontSize(11);
    pageDoc.text(
      subtitleLines,
      textX,
      headerCardY + 18 + titleLines.length * titleLineHeight + 8,
      { baseline: "top" },
    );
  };

  await drawDashboardHeader();
  pageDoc.addImage(imageData, "PNG", marginX, contentStartY, availableWidth, imageHeight, undefined, "FAST");

  let heightLeft = imageHeight - pageContentHeight;
  let currentOffset = pageContentHeight;

  while (heightLeft > 0) {
    pageDoc.addPage();
    pageDoc.setFillColor(248, 249, 251);
    pageDoc.rect(0, 0, pageWidth, pageHeight, "F");
    pageDoc.addImage(
      imageData,
      "PNG",
      marginX,
      contentStartY - currentOffset,
      availableWidth,
      imageHeight,
      undefined,
      "FAST",
    );

    currentOffset += pageContentHeight;
    heightLeft -= pageContentHeight;
  }

  applyPdfFooter(
    pageDoc,
    theme,
    `${theme.brandLabel} • ${context.funnelName ?? "Dashboard"}`,
  );

  const fileBaseName = context.fileBaseName || buildFileBaseName([
    context.funnelName || theme.brandLabel,
    "dashboard",
    new Date().toISOString().slice(0, 10),
  ]);

  pageDoc.save(`${fileBaseName}.pdf`);
};
