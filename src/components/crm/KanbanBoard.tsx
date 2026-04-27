import { useMemo, useState } from "react";
import { Lead, PipelineStage, Profile } from "@/types/crm";
import { LeadCard } from "./LeadCard";
import { useUpdateLead } from "@/hooks/useLeads";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface Props {
  stages: PipelineStage[];
  leads: Lead[];
  profiles: Profile[];
  onSelectLead: (lead: Lead) => void;
  onAddInStage: (stageId: string) => void;
}

const stageColorBar: Record<string, string> = {
  novo_lead: "bg-stage-novo",
  primeiro_contato: "bg-stage-primeiro",
  reuniao_marcada: "bg-stage-reuniao",
  proposta_enviada: "bg-stage-proposta",
  em_negociacao: "bg-stage-negociacao",
  fechado: "bg-stage-fechado",
  perdido: "bg-stage-perdido",
};

export const KanbanBoard = ({ stages, leads, profiles, onSelectLead, onAddInStage }: Props) => {
  const update = useUpdateLead();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);

  const leadsByStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    stages.forEach((s) => (map[s.id] = []));
    leads.forEach((l) => { (map[l.stage_id] ||= []).push(l); });
    return map;
  }, [stages, leads]);

  const handleDrop = async (stageId: string) => {
    if (!draggedId) return;
    const lead = leads.find((l) => l.id === draggedId);
    setDraggedId(null);
    setOverStageId(null);
    if (!lead || lead.stage_id === stageId) return;
    await update.mutateAsync({ id: lead.id, stage_id: stageId });
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin h-full">
      {stages.map((stage) => {
        const stageLeads = leadsByStage[stage.id] || [];
        const total = stageLeads.reduce((sum, l) => sum + Number(l.estimated_value || 0), 0);
        const isOver = overStageId === stage.id;

        return (
          <div
            key={stage.id}
            className="flex-shrink-0 w-72 flex flex-col bg-secondary/40 rounded-lg"
            onDragOver={(e) => { e.preventDefault(); setOverStageId(stage.id); }}
            onDragLeave={() => setOverStageId((id) => (id === stage.id ? null : id))}
            onDrop={() => handleDrop(stage.id)}
          >
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", stageColorBar[stage.key] || "bg-muted-foreground")} />
                  <h3 className="font-semibold text-sm text-foreground truncate">{stage.name}</h3>
                  <span className="text-xs text-muted-foreground bg-background rounded px-1.5 py-0.5 font-medium">{stageLeads.length}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAddInStage(stage.id)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{formatCurrency(total)}</p>
            </div>

            <div
              className={cn(
                "flex-1 overflow-y-auto px-2 pb-3 space-y-2 scrollbar-thin transition-smooth min-h-[200px]",
                isOver && "bg-accent/10 ring-2 ring-accent/30 ring-inset rounded"
              )}
            >
              {stageLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  profiles={profiles}
                  onClick={() => onSelectLead(lead)}
                  onDragStart={(e) => {
                    setDraggedId(lead.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                />
              ))}
              {stageLeads.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-8">Sem leads</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
