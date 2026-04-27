import { Lead, Profile } from "@/types/crm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/constants";
import { Calendar, DollarSign, User, CheckCircle2, Circle, Phone, Mail, MessageSquare, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  lead: Lead;
  profiles: Profile[];
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

const tempStyles: Record<string, string> = {
  frio: "bg-temp-frio/10 text-temp-frio border-temp-frio/25",
  morno: "bg-temp-morno/10 text-temp-morno border-temp-morno/30",
  quente: "bg-temp-quente/10 text-temp-quente border-temp-quente/30",
};
const tempBar: Record<string, string> = {
  frio: "bg-temp-frio",
  morno: "bg-temp-morno",
  quente: "bg-temp-quente",
};
const tempLabel: Record<string, string> = { frio: "Frio", morno: "Morno", quente: "Quente" };

type FollowUpStatus = "atrasado" | "hoje" | "futuro" | "sem";
function getFollowUpStatus(date: string | null | undefined): FollowUpStatus {
  if (!date) return "sem";
  const d = new Date(date);
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  if (d.getTime() < today.getTime()) return "atrasado";
  if (d.getTime() === today.getTime()) return "hoje";
  return "futuro";
}
const followUpStyles: Record<FollowUpStatus, string> = {
  atrasado: "text-status-atrasado",
  hoje: "text-status-pendente",
  futuro: "text-muted-foreground",
  sem: "text-muted-foreground",
};

export const LeadCard = ({ lead, profiles, onClick, onDragStart }: Props) => {
  const owner = profiles.find((p) => p.id === lead.owner_id);
  const followUpStatus = getFollowUpStatus(lead.next_follow_up);

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group relative overflow-hidden p-3 pl-3.5 cursor-pointer bg-card border border-border/70 shadow-xs hover:shadow-card-hover hover:border-border hover:-translate-y-0.5 transition-all duration-200 active:cursor-grabbing active:scale-[0.99]"
    >
      {/* Temperature side bar */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5",
          tempBar[lead.temperature] || "bg-muted"
        )}
      />

      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-sm leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {lead.company_or_person}
        </h4>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 font-medium shrink-0 rounded-md",
            tempStyles[lead.temperature]
          )}
        >
          {tempLabel[lead.temperature]}
        </Badge>
      </div>

      {lead.contact_name && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{lead.contact_name}</p>
      )}

      <div className="space-y-1.5 text-xs">
        {Number(lead.estimated_value) > 0 && (
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <DollarSign className="h-3 w-3 text-success" />
            <span>{formatCurrency(Number(lead.estimated_value))}</span>
          </div>
        )}

        {owner && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate">{owner.full_name || owner.email}</span>
          </div>
        )}

        {lead.next_follow_up && (
          <div className={cn("flex items-center gap-1.5 font-medium", followUpStyles[followUpStatus])}>
            {followUpStatus === "atrasado" ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <Calendar className="h-3 w-3" />
            )}
            <span>
              {followUpStatus === "atrasado" && "Atrasado · "}
              {followUpStatus === "hoje" && "Hoje · "}
              {formatDate(lead.next_follow_up)}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-1 border-t border-border/50 mt-2">
          {lead.has_been_contacted ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-success font-medium">
              <CheckCircle2 className="h-3 w-3" /> Contatado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Circle className="h-3 w-3" /> Sem contato
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
            {lead.contact_method === "whatsapp" && <MessageSquare className="h-3 w-3" />}
            {lead.contact_method === "ligacao" && <Phone className="h-3 w-3" />}
            {lead.contact_method === "email" && <Mail className="h-3 w-3" />}
          </span>
        </div>
      </div>
    </Card>
  );
};
