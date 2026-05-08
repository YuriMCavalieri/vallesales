import { Lead, PipelineStage, Profile } from "@/types/crm";
import { LeadCard } from "./LeadCard";
import { useCreatePipelineStage, useRenamePipelineStage, useUpdateLead } from "@/hooks/useLeads";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Fragment, useMemo, useState } from "react";

interface Props {
  stages: PipelineStage[];
  leads: Lead[];
  profiles: Profile[];
  onSelectLead: (lead: Lead) => void;
  onAddInStage: (stageId: string) => void;
  canAddLead: boolean;
  canMoveLead: (lead: Lead) => boolean;
  canRenameStages: boolean;
  canCreateStages: boolean;
  funnelId: string;
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

export const KanbanBoard = ({
  stages,
  leads,
  profiles,
  onSelectLead,
  onAddInStage,
  canAddLead,
  canMoveLead,
  canRenameStages,
  canCreateStages,
  funnelId,
}: Props) => {
  const update = useUpdateLead();
  const createStage = useCreatePipelineStage();
  const renameStage = useRenamePipelineStage();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stageDraftName, setStageDraftName] = useState("");
  const [creatingAfterStageId, setCreatingAfterStageId] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState("");

  const leadsByStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    stages.forEach((stage) => {
      map[stage.id] = [];
    });
    leads.forEach((lead) => {
      (map[lead.stage_id] ||= []).push(lead);
    });
    return map;
  }, [stages, leads]);

  const maxStageValue = useMemo(() => {
    let max = 0;
    stages.forEach((stage) => {
      const value = (leadsByStage[stage.id] || []).reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0);
      if (value > max) max = value;
    });
    return max;
  }, [stages, leadsByStage]);

  const handleDrop = async (stageId: string) => {
    if (!draggedId) return;
    const lead = leads.find((item) => item.id === draggedId);
    setDraggedId(null);
    setOverStageId(null);
    if (!lead || lead.stage_id === stageId) return;
    await update.mutateAsync({ id: lead.id, stage_id: stageId });
  };

  const openStageRename = (stage: PipelineStage) => {
    setCreatingAfterStageId(null);
    setEditingStageId(stage.id);
    setStageDraftName(stage.name);
  };

  const cancelStageRename = () => {
    setEditingStageId(null);
    setStageDraftName("");
  };

  const handleStageRename = async (stage: PipelineStage) => {
    await renameStage.mutateAsync({
      funnelId: stage.funnel_id,
      stageId: stage.id,
      name: stageDraftName,
    });
    cancelStageRename();
  };

  const openCreateStage = (stageId: string) => {
    setEditingStageId(null);
    setCreatingAfterStageId(stageId);
    setNewStageName("");
  };

  const cancelCreateStage = () => {
    setCreatingAfterStageId(null);
    setNewStageName("");
  };

  const handleCreateStage = async (afterStageId: string) => {
    await createStage.mutateAsync({
      funnelId,
      afterStageId,
      name: newStageName,
    });
    cancelCreateStage();
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin h-full">
      {stages.map((stage, idx) => {
        const nextStage = stages[idx + 1] ?? null;
        const prevStage = idx > 0 ? stages[idx - 1] : null;
        const stageLeads = leadsByStage[stage.id] || [];
        const total = stageLeads.reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0);
        const prevCount = prevStage ? (leadsByStage[prevStage.id] || []).length : 0;
        const conversion = prevStage && prevCount > 0 ? Math.round((stageLeads.length / prevCount) * 100) : null;
        const isOver = overStageId === stage.id;
        const dotColor = stageColorBar[stage.key] || "bg-muted-foreground";
        const valuePct = maxStageValue > 0 ? Math.max(4, Math.round((total / maxStageValue) * 100)) : 0;
        const canCreateAfterStage = canCreateStages && !stage.is_won && !stage.is_lost;

        return (
          <Fragment key={stage.id}>
            <div
              className={cn(
                "group flex-shrink-0 w-72 flex flex-col rounded-xl border transition-all duration-200",
                isOver
                  ? "bg-accent/5 border-accent/40 shadow-card"
                  : "bg-muted/40 border-transparent hover:border-border/60",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                setOverStageId(stage.id);
              }}
              onDragLeave={() => setOverStageId((current) => (current === stage.id ? null : current))}
              onDrop={() => handleDrop(stage.id)}
            >
              <div className="border-b border-border/50 px-3 pb-2.5 pt-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background", dotColor)} />
                    {editingStageId === stage.id ? (
                      <>
                        <Input
                          value={stageDraftName}
                          onChange={(event) => setStageDraftName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleStageRename(stage);
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelStageRename();
                            }
                          }}
                          className="h-8 min-w-0 flex-1 text-[13px] font-semibold uppercase tracking-wide"
                          maxLength={120}
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-accent hover:bg-accent/10 hover:text-accent"
                          onClick={() => void handleStageRename(stage)}
                          disabled={renameStage.isPending || !stageDraftName.trim()}
                          aria-label={`Salvar nome da fase ${stage.name}`}
                          title="Salvar nome da fase"
                        >
                          {renameStage.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={cancelStageRename}
                          disabled={renameStage.isPending}
                          aria-label={`Cancelar edicao da fase ${stage.name}`}
                          title="Cancelar"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <h3 className="truncate text-[13px] font-semibold uppercase tracking-wide text-foreground">{stage.name}</h3>
                        {canRenameStages && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground/80 hover:bg-accent/10 hover:text-accent"
                            onClick={() => openStageRename(stage)}
                            aria-label={`Editar nome da fase ${stage.name}`}
                            title="Editar nome da fase"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <span className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                          {stageLeads.length}
                        </span>
                      </>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 transition-all group-hover:opacity-100 hover:bg-accent/10 hover:text-accent"
                    onClick={() => {
                      if (canCreateAfterStage) {
                        openCreateStage(stage.id);
                        return;
                      }
                      onAddInStage(stage.id);
                    }}
                    title={canCreateAfterStage ? "Adicionar fase" : "Adicionar lead nesta etapa"}
                    disabled={canCreateAfterStage ? createStage.isPending : !canAddLead}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold tabular-nums text-foreground/80">
                    {formatCurrency(total)}
                  </p>
                  {conversion !== null && (
                    <span
                      title={`Conversao a partir de "${prevStage?.name}" (${stageLeads.length}/${prevCount})`}
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                        conversion >= 70
                          ? "border-success/25 bg-success/10 text-success"
                          : conversion >= 40
                            ? "border-accent/25 bg-accent/10 text-accent"
                            : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {conversion}%
                    </span>
                  )}
                </div>

                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border/60">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", dotColor)}
                    style={{ width: `${valuePct}%` }}
                  />
                </div>
              </div>

              <div
                className={cn(
                  "min-h-[200px] flex-1 space-y-2 overflow-y-auto rounded-b-xl px-2 py-2 scrollbar-thin transition-all",
                  isOver && "bg-accent/5",
                )}
              >
                {stageLeads.map((lead) => (
                  <div key={lead.id} className="animate-fade-in-up">
                    <LeadCard
                      lead={lead}
                      profiles={profiles}
                      onClick={() => onSelectLead(lead)}
                      draggable={canMoveLead(lead)}
                      onDragStart={(event) => {
                        setDraggedId(lead.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                    />
                  </div>
                ))}

                {stageLeads.length === 0 && canAddLead && (
                  <button
                    onClick={() => onAddInStage(stage.id)}
                    className="w-full rounded-lg border border-dashed border-border/60 px-3 py-8 text-center text-xs text-muted-foreground transition-all hover:border-accent/50 hover:bg-accent/5 hover:text-accent"
                  >
                    + Adicionar lead
                  </button>
                )}
              </div>
            </div>

            {creatingAfterStageId === stage.id && (
              <div className="flex-shrink-0 w-60">
                <div className="flex h-full min-h-[200px] flex-col justify-center rounded-xl border border-dashed border-accent/35 bg-accent/5 px-4 py-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Nova fase
                  </p>
                  <p className="mt-1 text-sm text-foreground/80">
                    {nextStage ? `Entre ${stage.name} e ${nextStage.name}` : `Depois de ${stage.name}`}
                  </p>

                  <Input
                    value={newStageName}
                    onChange={(event) => setNewStageName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleCreateStage(stage.id);
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelCreateStage();
                      }
                    }}
                    placeholder="Nome da nova fase"
                    maxLength={120}
                    autoFocus
                    className="mt-4"
                  />

                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="accent"
                      size="sm"
                      className="flex-1"
                      onClick={() => void handleCreateStage(stage.id)}
                      disabled={createStage.isPending || !newStageName.trim()}
                    >
                      {createStage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Criar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={cancelCreateStage}
                      disabled={createStage.isPending}
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
};
