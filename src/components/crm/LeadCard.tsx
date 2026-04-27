import { Lead, PipelineStage, Profile } from "@/types/crm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/constants";
import { Calendar, DollarSign, User, CheckCircle2, Circle, Phone, Mail, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  lead: Lead;
  profiles: Profile[];
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

const tempStyles: Record<string, string> = {
  frio: "bg-temp-frio/10 text-temp-frio border-temp-frio/30",
  morno: "bg-temp-morno/10 text-temp-morno border-temp-morno/30",
  quente: "bg-temp-quente/10 text-temp-quente border-temp-quente/30",
};

const tempLabel: Record<string, string> = { frio: "Frio", morno: "Morno", quente: "Quente" };

export const LeadCard = ({ lead, profiles, onClick, onDragStart }: Props) => {
  const owner = profiles.find((p) => p.id === lead.owner_id);

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="p-3 cursor-pointer hover:shadow-card-hover transition-smooth border bg-card group active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-sm leading-tight text-foreground group-hover:text-primary transition-smooth line-clamp-2">
          {lead.company_or_person}
        </h4>
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-medium shrink-0", tempStyles[lead.temperature])}>
          {tempLabel[lead.temperature]}
        </Badge>
      </div>

      {lead.contact_name && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{lead.contact_name}</p>
      )}

      <div className="space-y-1.5 text-xs">
        {Number(lead.estimated_value) > 0 && (
          <div className="flex items-center gap-1.5 text-foreground font-medium">
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
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(lead.next_follow_up)}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-1">
          {lead.has_been_contacted ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-success font-medium">
              <CheckCircle2 className="h-3 w-3" /> Contatado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Circle className="h-3 w-3" /> Sem contato
            </span>
          )}
          {lead.contact_method === "whatsapp" && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
          {lead.contact_method === "ligacao" && <Phone className="h-3 w-3 text-muted-foreground" />}
          {lead.contact_method === "email" && <Mail className="h-3 w-3 text-muted-foreground" />}
        </div>
      </div>
    </Card>
  );
};
