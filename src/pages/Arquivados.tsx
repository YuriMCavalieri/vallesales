import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { LeadDetailsSheet } from "@/components/crm/LeadDetailsSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useActiveFunnel } from "@/hooks/useActiveFunnel";
import { useLeads, useProfiles, useReopenLead, useRestoreLead, useStages } from "@/hooks/useLeads";
import { usePermissions } from "@/hooks/useUserRoles";
import { formatCurrency, formatDateTime } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types/crm";
import {
  ArchiveRestore,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronDown,
  FolderArchive,
  Loader2,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

type ArchivedSituation = "lost" | "won";
type ArchivedSituationFilter = "all" | ArchivedSituation;

const ALL_FUNNELS_VALUE = "__all_funnels__";

const situationLabels: Record<ArchivedSituation, string> = {
  lost: "Perdido",
  won: "Cliente",
};

const situationStyles: Record<ArchivedSituation, string> = {
  lost: "bg-destructive/10 text-destructive border-destructive/25",
  won: "bg-success/10 text-success border-success/25",
};

const normalizeText = (value?: string | null) => (value ?? "").trim().toLowerCase();

const ArchivedLeads = () => {
  const { activeFunnelId, funnels, loading: funnelLoading } = useActiveFunnel();
  const perms = usePermissions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ArchivedSituationFilter>("all");
  const [selectedFunnelIds, setSelectedFunnelIds] = useState<string[]>([]);
  const [funnelFilterOpen, setFunnelFilterOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const accessibleFunnelIds = useMemo(() => funnels.map((funnel) => funnel.id), [funnels]);
  const hasAvailableFunnels = accessibleFunnelIds.length > 0;
  const leads = useLeads(null, hasAvailableFunnels, { archived: "archived" });
  const stages = useStages(undefined, hasAvailableFunnels);
  const profiles = useProfiles(hasAvailableFunnels);
  const restoreLead = useRestoreLead();
  const reopenLead = useReopenLead();

  useEffect(() => {
    if (accessibleFunnelIds.length === 0) {
      setSelectedFunnelIds([]);
      return;
    }

    setSelectedFunnelIds((current) => {
      const validCurrent = current.filter((id) => accessibleFunnelIds.includes(id));
      if (validCurrent.length > 0) return validCurrent;
      if (activeFunnelId && accessibleFunnelIds.includes(activeFunnelId)) return [activeFunnelId];
      return [...accessibleFunnelIds];
    });
  }, [accessibleFunnelIds, activeFunnelId]);

  const allFunnelsSelected = hasAvailableFunnels && selectedFunnelIds.length === accessibleFunnelIds.length;
  const selectedFunnels = useMemo(
    () => funnels.filter((funnel) => selectedFunnelIds.includes(funnel.id)),
    [funnels, selectedFunnelIds],
  );

  const stagesById = useMemo(
    () => new Map((stages.data ?? []).map((stage) => [stage.id, stage])),
    [stages.data],
  );

  const ownerNameById = useMemo(
    () => new Map((profiles.data ?? []).map((profile) => [profile.id, profile.full_name || profile.email || "Sem nome"])),
    [profiles.data],
  );

  const canEditLead = (lead: Lead) => {
    if (perms.canEditAnyLead) return true;
    if (!perms.canEditOwnLead) return false;
    return lead.owner_id === perms.profile?.id || lead.created_by === perms.profile?.id;
  };

  const archivedRows = useMemo(() => {
    return (leads.data ?? [])
      .map((lead) => {
        if (!lead.is_archived) return null;

        const stage = stagesById.get(lead.stage_id);
        if (!stage) return null;
        const commercialStatus: ArchivedSituation = stage.is_lost ? "lost" : "won";

        return {
          lead,
          commercialStatus,
          funnelName: funnels.find((funnel) => funnel.id === lead.funnel_id)?.name ?? "Funil nao identificado",
          ownerName: lead.owner_id ? ownerNameById.get(lead.owner_id) ?? "Responsavel nao encontrado" : "Sem responsavel",
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((left, right) => new Date(right.lead.archived_at ?? 0).getTime() - new Date(left.lead.archived_at ?? 0).getTime());
  }, [funnels, leads.data, ownerNameById, stagesById]);

  const scopedRows = useMemo(() => {
    const allowedFunnels = new Set(selectedFunnelIds);

    return archivedRows.filter((row) => {
      if (allowedFunnels.size > 0 && !allowedFunnels.has(row.lead.funnel_id)) return false;
      return true;
    });
  }, [archivedRows, selectedFunnelIds]);

  const filteredRows = useMemo(() => {
    const query = normalizeText(search);

    return scopedRows.filter((row) => {
      if (statusFilter !== "all" && row.commercialStatus !== statusFilter) return false;

      if (!query) return true;

      const haystack = [
        row.lead.company_or_person,
        row.lead.contact_name,
        row.lead.phone,
        row.lead.email,
        row.ownerName,
        row.funnelName,
        row.lead.loss_reason,
        situationLabels[row.commercialStatus],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [scopedRows, search, statusFilter]);

  const toggleFunnel = (funnelId: string) => {
    setSelectedFunnelIds((current) => {
      if (current.includes(funnelId)) {
        const next = current.filter((id) => id !== funnelId);
        return next.length === 0 ? current : next;
      }

      return [...current, funnelId];
    });
  };

  const handleFunnelSelection = (value: string) => {
    if (value === ALL_FUNNELS_VALUE) {
      setSelectedFunnelIds([...accessibleFunnelIds]);
      return;
    }

    toggleFunnel(value);
  };

  const funnelFilterLabel = useMemo(() => {
    if (!hasAvailableFunnels) return "Nenhum funil";
    if (allFunnelsSelected) return "Todos os funis";
    if (selectedFunnels.length === 1) return selectedFunnels[0]?.name ?? "1 funil";
    return `${selectedFunnels.length} funis selecionados`;
  }, [allFunnelsSelected, hasAvailableFunnels, selectedFunnels]);

  const statusSummaryLabel = useMemo(() => {
    if (statusFilter === "lost") return "Mostrando apenas negocios perdidos.";
    if (statusFilter === "won") return "Mostrando apenas clientes fechados.";
    return "Mostrando todos os negocios arquivados.";
  }, [statusFilter]);

  const hasActiveFilters = !!search.trim() || statusFilter !== "all" || !allFunnelsSelected;
  const loading = funnelLoading || leads.isLoading || stages.isLoading || profiles.isLoading;
  const error =
    (leads.error as Error | null) ??
    (stages.error as Error | null) ??
    (profiles.error as Error | null);

  const handleOpenLead = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailsOpen(true);
  };

  const handleRestore = async (lead: Lead) => {
    await restoreLead.mutateAsync(lead.id);
    if (selectedLead?.id === lead.id) {
      setDetailsOpen(false);
      setSelectedLead(null);
    }
  };

  const handleReopen = async (lead: Lead) => {
    await reopenLead.mutateAsync({ id: lead.id });
    if (selectedLead?.id === lead.id) {
      setDetailsOpen(false);
      setSelectedLead(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader active="arquivados" />

      <div className="border-b border-border bg-gradient-to-b from-card via-card to-accent/5 px-4 py-6 md:px-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card className="border-border/70 bg-background/75 p-5 shadow-card backdrop-blur">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-accent/12 p-3 text-accent">
                  <FolderArchive className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Historico comercial</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">Negocios arquivados</h2>
                  <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                    Espaco dedicado para negocios que ja sairam da operacao principal, sem misturar com os contatos nem poluir o funil.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <FilterStatCard
                  label="Todos os arquivados"
                  helper="Visao completa do historico"
                  value={String(scopedRows.length)}
                  icon={<FolderArchive className="h-4 w-4" />}
                  active={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                />
                <FilterStatCard
                  label="Fechados (clientes)"
                  helper="Clique para ver so clientes"
                  value={String(scopedRows.filter((row) => row.commercialStatus === "won").length)}
                  icon={<Check className="h-4 w-4" />}
                  active={statusFilter === "won"}
                  onClick={() => setStatusFilter("won")}
                />
                <FilterStatCard
                  label="Negocios perdidos"
                  helper="Clique para ver so perdidos"
                  value={String(scopedRows.filter((row) => row.commercialStatus === "lost").length)}
                  icon={<X className="h-4 w-4" />}
                  active={statusFilter === "lost"}
                  onClick={() => setStatusFilter("lost")}
                />
              </div>
            </div>
          </Card>

          <Card className="border-border/70 bg-background/85 p-5 shadow-card">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Refinar consulta</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Busque por empresa, contato, responsavel, funil ou motivo da perda.
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar nos arquivados..."
                  className="h-10 bg-background pl-8"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Popover open={funnelFilterOpen} onOpenChange={setFunnelFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full justify-between bg-background font-normal"
                    disabled={!hasAvailableFunnels}
                  >
                    <span className="truncate text-left">{funnelFilterLabel}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="end">
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => handleFunnelSelection(ALL_FUNNELS_VALUE)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60",
                        allFunnelsSelected && "bg-muted/60",
                      )}
                    >
                      <Checkbox checked={allFunnelsSelected} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">Todos os funis</p>
                        <p className="text-xs text-muted-foreground">
                          {accessibleFunnelIds.length === 1
                            ? "Equivale ao unico funil disponivel."
                            : `Inclui os ${accessibleFunnelIds.length} funis disponiveis para voce.`}
                        </p>
                      </div>
                    </button>

                    <div className="my-2 h-px bg-border" />

                    {funnels.map((funnel) => {
                      const checked = selectedFunnelIds.includes(funnel.id);

                      return (
                        <button
                          key={funnel.id}
                          type="button"
                          onClick={() => handleFunnelSelection(funnel.id)}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60",
                            checked && "bg-muted/60",
                          )}
                        >
                          <Checkbox checked={checked} />
                          <span className="min-w-0 flex-1 truncate text-foreground">{funnel.name}</span>
                          {checked && <Check className="h-4 w-4 text-accent" />}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                {statusSummaryLabel}
              </div>
            </div>
          </Card>
        </div>

        {hasActiveFilters && (
          <div className="mt-4 text-xs text-muted-foreground">
            {filteredRows.length} negocio(s) encontrado(s)
          </div>
        )}
      </div>

      <main className="flex-1 px-4 py-6 md:px-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : !hasAvailableFunnels ? (
          <Card className="mx-auto max-w-2xl p-8 text-center">
            <h3 className="text-lg font-semibold text-foreground">Nenhum funil disponivel</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Seu usuario nao possui acesso a um funil ativo no momento.
            </p>
          </Card>
        ) : error ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
            <X className="h-8 w-8 text-destructive" />
            <h3 className="text-lg font-semibold text-foreground">Nao foi possivel carregar os arquivados</h3>
            <p className="text-sm text-muted-foreground">
              {error.message || "Erro ao carregar os dados do funil."}
            </p>
          </div>
        ) : filteredRows.length === 0 ? (
          <Card className="mx-auto max-w-2xl p-8 text-center">
            <h3 className="text-lg font-semibold text-foreground">Nenhum negocio arquivado encontrado</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ajuste os filtros ou aguarde novos arquivamentos para visualizar historico aqui.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredRows.map((row) => {
              const isMutating = restoreLead.isPending || reopenLead.isPending;

              return (
                <Card
                  key={row.lead.id}
                  className="group cursor-pointer border-border/70 bg-card/90 p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-lg"
                  onClick={() => handleOpenLead(row.lead)}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={situationStyles[row.commercialStatus]}>
                            {row.commercialStatus === "won" ? "Fechado (cliente)" : "Perdido"}
                          </Badge>
                          <Badge variant="outline" className="border-border/70 bg-muted/30 text-muted-foreground">
                            {row.funnelName}
                          </Badge>
                        </div>
                        <h3 className="mt-3 truncate text-lg font-semibold text-foreground">
                          {row.lead.company_or_person}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.lead.contact_name || "Sem contato principal"} {row.lead.phone ? `• ${row.lead.phone}` : ""}
                        </p>
                      </div>

                      <div className="shrink-0 rounded-2xl bg-accent/8 p-3 text-accent">
                        {row.commercialStatus === "won" ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <InfoPill
                        icon={<CalendarClock className="h-3.5 w-3.5" />}
                        label="Arquivado em"
                        value={formatDateTime(row.lead.archived_at)}
                      />
                      <InfoPill
                        icon={<BriefcaseBusiness className="h-3.5 w-3.5" />}
                        label={row.commercialStatus === "won" ? "Marcado como cliente" : "Marcado como perdido"}
                        value={formatDateTime(row.commercialStatus === "lost" ? row.lead.lost_at : row.lead.won_at)}
                      />
                      <InfoPill label="Responsavel" value={row.ownerName} />
                      <InfoPill
                        label="Valor"
                        value={Number(row.lead.estimated_value) > 0 ? formatCurrency(row.lead.estimated_value) : "-"}
                      />
                    </div>

                    {row.lead.loss_reason && (
                      <div className="rounded-xl border border-destructive/15 bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Motivo da perda:</span> {row.lead.loss_reason}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenLead(row.lead);
                        }}
                      >
                        Ver detalhes
                      </Button>
                      {canEditLead(row.lead) && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isMutating}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleRestore(row.lead);
                            }}
                          >
                            <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
                            Restaurar ao funil
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="accent"
                            disabled={isMutating}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleReopen(row.lead);
                            }}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            Reabrir negocio
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <LeadDetailsSheet
        lead={selectedLead}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onLeadChange={setSelectedLead}
        profiles={profiles.data ?? []}
        stages={stages.data ?? []}
        canEditLead={selectedLead ? canEditLead(selectedLead) : false}
        canDeleteLead={false}
        restoreLead={selectedLead ? async () => {
          await handleRestore(selectedLead);
        } : undefined}
        reopenLead={selectedLead ? async () => {
          await handleReopen(selectedLead);
        } : undefined}
      />
    </div>
  );
};

const FilterStatCard = ({
  label,
  helper,
  value,
  icon,
  active,
  onClick,
}: {
  label: string;
  helper: string;
  value: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
      active
        ? "border-accent bg-accent/8 shadow-sm"
        : "border-border/70 bg-background hover:border-accent/35 hover:bg-accent/5",
    )}
  >
    <div className={cn("rounded-xl p-2.5", active ? "bg-accent text-accent-foreground" : "bg-accent/10 text-accent")}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-none text-foreground">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
    </div>
  </button>
);

const InfoPill = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) => (
  <div className="rounded-xl border border-border/70 bg-muted/15 px-3 py-2.5">
    <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
      {icon}
      {label}
    </p>
    <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
  </div>
);

export default ArchivedLeads;
