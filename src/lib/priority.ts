import { Lead } from "@/types/crm";

export type Priority = "alta" | "media" | "baixa" | "normal";

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const isOverdue = (lead: Lead, today = startOfToday()) => {
  if (!lead.next_follow_up) return false;
  const d = new Date(lead.next_follow_up);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
};

export const isToday = (lead: Lead, today = startOfToday()) => {
  if (!lead.next_follow_up) return false;
  const d = new Date(lead.next_follow_up);
  d.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
};

/**
 * Calcula a prioridade de um lead:
 * - alta: follow-up atrasado OU (quente sem contato)
 * - média: quente OU sem contato OU follow-up hoje
 * - baixa: morno
 * - normal: demais (frio com follow-up futuro)
 */
export const getLeadPriority = (lead: Lead, today = startOfToday()): Priority => {
  const overdue = isOverdue(lead, today);
  const noContact = !lead.has_been_contacted;
  const hot = lead.temperature === "quente";
  const todayFu = isToday(lead, today);

  if (overdue) return "alta";
  if (hot && noContact) return "alta";
  if (hot || noContact || todayFu) return "media";
  if (lead.temperature === "morno") return "baixa";
  return "normal";
};

/**
 * Indica se o lead requer ação hoje:
 * - follow-up atrasado, OU
 * - follow-up agendado para hoje, OU
 * - lead quente que ainda não foi contatado
 */
export const needsActionToday = (lead: Lead, today = startOfToday()) => {
  if (isOverdue(lead, today)) return true;
  if (isToday(lead, today)) return true;
  if (lead.temperature === "quente" && !lead.has_been_contacted) return true;
  return false;
};

export const priorityMeta: Record<Priority, { label: string; className: string }> = {
  alta: { label: "Alta", className: "bg-destructive/10 text-destructive border-destructive/30" },
  media: { label: "Média", className: "bg-warning/10 text-warning border-warning/30" },
  baixa: { label: "Baixa", className: "bg-muted text-muted-foreground border-border" },
  normal: { label: "Normal", className: "bg-muted text-muted-foreground border-border" },
};
