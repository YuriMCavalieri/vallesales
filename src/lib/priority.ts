import { Lead } from "@/types/crm";
import { startOfLocalDay } from "@/lib/date";

export type Priority = "alta" | "media" | "baixa" | "normal";

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const isOverdue = (lead: Lead, today = startOfToday()) => {
  const followUp = startOfLocalDay(lead.next_follow_up);
  if (!followUp) return false;
  return followUp.getTime() < today.getTime();
};

export const isToday = (lead: Lead, today = startOfToday()) => {
  const followUp = startOfLocalDay(lead.next_follow_up);
  if (!followUp) return false;
  return followUp.getTime() === today.getTime();
};

export const getLeadPriority = (lead: Lead, today = startOfToday()): Priority => {
  const overdue = isOverdue(lead, today);
  const noContact = !lead.has_been_contacted;
  const hot = lead.temperature === "quente";
  const todayFollowUp = isToday(lead, today);

  if (overdue) return "alta";
  if (hot && noContact) return "alta";
  if (hot || noContact || todayFollowUp) return "media";
  if (lead.temperature === "morno") return "baixa";
  return "normal";
};

export const needsActionToday = (lead: Lead, today = startOfToday()) => {
  if (isOverdue(lead, today)) return true;
  if (isToday(lead, today)) return true;
  if (lead.temperature === "quente" && !lead.has_been_contacted) return true;
  return false;
};

export const priorityMeta: Record<Priority, { label: string; className: string }> = {
  alta: { label: "Alta", className: "bg-destructive/10 text-destructive border-destructive/30" },
  media: { label: "Media", className: "bg-warning/10 text-warning border-warning/30" },
  baixa: { label: "Baixa", className: "bg-muted text-muted-foreground border-border" },
  normal: { label: "Normal", className: "bg-muted text-muted-foreground border-border" },
};
