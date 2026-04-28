import { useState, useMemo, useEffect } from "react";
import { useStages, useLeads, useProfiles } from "@/hooks/useLeads";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { LeadFormDialog } from "@/components/crm/LeadFormDialog";
import { LeadDetailsSheet } from "@/components/crm/LeadDetailsSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import {
  Building2, Plus, LogOut, Search, Loader2, Thermometer, DollarSign, TrendingUp,
  Users, AlertTriangle, X, UserCheck, LayoutDashboard, Kanban,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Lead } from "@/types/crm";
import { formatCurrency } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatusFilter = "todos" | "atrasados" | "sem_contato" | "follow_hoje";

const Index = () => {
  const { signOut, user } = useAuth();
  const stages = useStages();
  const leads = useLeads();
  const profiles = useProfiles();

  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [onlyMine, setOnlyMine] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [defaultStage, setDefaultStage] = useState<string | undefined>();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isOverdue = (lead: Lead) => {
    if (!lead.next_follow_up) return false;
    const d = new Date(lead.next_follow_up);
    d.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  };
  const isToday = (lead: Lead) => {
    if (!lead.next_follow_up) return false;
    const d = new Date(lead.next_follow_up);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  };

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (leads.data ?? []).filter((l) => {
      // apenas meus leads
      if (onlyMine && l.owner_id !== user?.id) return false;
      // busca
      if (q) {
        const hay = [l.company_or_person, l.contact_name, l.email, l.phone, l.city]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // responsável
      if (ownerFilter !== "all") {
        if (ownerFilter === "none" ? l.owner_id : l.owner_id !== ownerFilter) return false;
      }
      // status
      if (statusFilter === "atrasados" && !isOverdue(l)) return false;
      if (statusFilter === "sem_contato" && l.has_been_contacted) return false;
      if (statusFilter === "follow_hoje" && !isToday(l)) return false;
      return true;
    });
  }, [leads.data, search, ownerFilter, statusFilter, today, onlyMine, user?.id]);

  const stats = useMemo(() => {
    const all = leads.data ?? [];
    const won = stages.data?.find((s) => s.is_won)?.id;
    const lost = stages.data?.find((s) => s.is_lost)?.id;
    const open = all.filter((l) => l.stage_id !== won && l.stage_id !== lost);
    const pipelineValue = open.reduce((s, l) => s + Number(l.estimated_value || 0), 0);
    const wonValue = all.filter((l) => l.stage_id === won).reduce((s, l) => s + Number(l.estimated_value || 0), 0);
    const overdue = open.filter(isOverdue).length;
    const noContact = open.filter((l) => !l.has_been_contacted).length;
    return { count: open.length, pipelineValue, wonValue, overdue, noContact };
  }, [leads.data, stages.data, today]);

  const openNew = (stageId?: string) => {
    setEditLead(null);
    setDefaultStage(stageId);
    setFormOpen(true);
  };
  const openEdit = (lead: Lead) => {
    setEditLead(lead);
    setFormOpen(true);
  };
  const openDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailsOpen(true);
  };

  // Atalho: tecla "N" abre novo lead
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (formOpen || detailsOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openNew();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [formOpen, detailsOpen]);

  const loading = stages.isLoading || leads.isLoading;
  const hasActiveFilters = ownerFilter !== "all" || statusFilter !== "todos" || !!search || onlyMine;
  const clearFilters = () => {
    setSearch("");
    setOwnerFilter("all");
    setStatusFilter("todos");
    setOnlyMine(false);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-gradient-header text-primary-foreground shadow-sm border-b border-primary/20">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-accent rounded-lg p-2 shrink-0 shadow-sm">
              <Building2 className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base md:text-lg leading-tight truncate tracking-tight">Valle Consultores</h1>
              <p className="text-[11px] text-primary-foreground/70 leading-tight truncate uppercase tracking-wider font-medium">CRM Comercial</p>
            </div>
          </div>
          <nav className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            <Link to="/">
              <Button variant="ghost" size="sm" className="bg-white/10 text-primary-foreground hover:bg-white/15 h-8">
                <Kanban className="h-4 w-4 md:mr-1.5" />
                <span className="hidden md:inline">Funil</span>
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground h-8">
                <LayoutDashboard className="h-4 w-4 md:mr-1.5" />
                <span className="hidden md:inline">Dashboard</span>
              </Button>
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden md:block text-sm text-primary-foreground/80 truncate max-w-[200px]">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
              <LogOut className="h-4 w-4 md:mr-1" />
              <span className="hidden md:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Stats + actions */}
      <div className="px-4 md:px-6 py-5 border-b border-border bg-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Funil comercial</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Acompanhe e gerencie seus leads em tempo real
            </p>
          </div>
          <Button
            onClick={() => openNew()}
            variant="accent"
            size="lg"
            className="shrink-0 font-semibold shadow-card"
            title="Novo lead (atalho: N)"
          >
            <Plus className="h-4 w-4 mr-1" /> Novo lead
            <kbd className="hidden md:inline-flex ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-black/15 rounded">N</kbd>
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Em aberto" value={String(stats.count)} tone="primary" />
          <StatCard icon={<DollarSign className="h-4 w-4" />} label="Pipeline" value={formatCurrency(stats.pipelineValue)} tone="accent" />
          <StatCard icon={<Thermometer className="h-4 w-4" />} label="Fechados" value={formatCurrency(stats.wonValue)} tone="success" />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Atrasados"
            value={String(stats.overdue)}
            tone={stats.overdue > 0 ? "danger" : "muted"}
            clickable
            active={statusFilter === "atrasados"}
            onClick={() => setStatusFilter(statusFilter === "atrasados" ? "todos" : "atrasados")}
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, empresa, e-mail, telefone ou cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 bg-background border-border focus-visible:ring-accent/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-2 h-5 w-5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center justify-center transition-colors"
                aria-label="Limpar busca"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Apenas meus leads */}
          <button
            type="button"
            onClick={() => setOnlyMine((v) => !v)}
            className={cn(
              "h-9 px-3 inline-flex items-center gap-2 rounded-md border text-sm font-medium transition-all shrink-0",
              onlyMine
                ? "bg-accent text-accent-foreground border-accent shadow-sm"
                : "bg-background text-foreground border-border hover:border-accent/40 hover:text-accent"
            )}
            title="Mostrar somente leads em que sou responsável"
          >
            <UserCheck className="h-4 w-4" />
            <span className="hidden md:inline">Meus leads</span>
            <Switch checked={onlyMine} className="pointer-events-none scale-75 -mr-1" />
          </button>

          <Select value={ownerFilter} onValueChange={setOwnerFilter} disabled={onlyMine}>
            <SelectTrigger className="md:w-56 h-9 bg-background">
              <Users className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              <SelectItem value="none">Sem responsável</SelectItem>
              {(profiles.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="md:w-52 h-9 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="atrasados">⚠ Follow-up atrasado</SelectItem>
              <SelectItem value="follow_hoje">📅 Follow-up hoje</SelectItem>
              <SelectItem value="sem_contato">○ Sem contato</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5 mr-1" /> Limpar
            </Button>
          )}
        </div>

        {/* Resumo de filtros ativos */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <span>{filteredLeads.length} lead(s) encontrado(s)</span>
            {statusFilter === "atrasados" && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                Atrasados
              </Badge>
            )}
            {statusFilter === "sem_contato" && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                Sem contato
              </Badge>
            )}
            {statusFilter === "follow_hoje" && (
              <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                Follow-up hoje
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Kanban */}
      <main className="flex-1 overflow-hidden px-4 md:px-6 py-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : (
          <KanbanBoard
            stages={stages.data ?? []}
            leads={filteredLeads}
            profiles={profiles.data ?? []}
            onSelectLead={openDetails}
            onAddInStage={(s) => openNew(s)}
          />
        )}
      </main>

      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={editLead}
        defaultStageId={defaultStage}
      />

      <LeadDetailsSheet
        lead={selectedLead}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        profiles={profiles.data ?? []}
        stages={stages.data ?? []}
        onEdit={() => {
          if (selectedLead) {
            setDetailsOpen(false);
            openEdit(selectedLead);
          }
        }}
      />
    </div>
  );
};

const toneStyles: Record<string, string> = {
  primary: "bg-primary/8 text-primary",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

const StatCard = ({
  icon, label, value, tone = "primary", clickable, active, onClick,
}: {
  icon: React.ReactNode; label: string; value: string;
  tone?: "primary" | "accent" | "success" | "danger" | "muted";
  clickable?: boolean; active?: boolean; onClick?: () => void;
}) => (
  <Card
    onClick={clickable ? onClick : undefined}
    className={cn(
      "p-3.5 flex items-center gap-3 border-border/70 shadow-xs transition-all duration-200",
      clickable && "cursor-pointer hover:shadow-card hover:-translate-y-0.5 hover:border-border",
      active && "ring-2 ring-accent/40 border-accent/40",
    )}
  >
    <div className={`rounded-lg p-2.5 ${toneStyles[tone]}`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground truncate font-medium">{label}</p>
      <p className="font-bold text-base md:text-lg truncate tabular-nums text-foreground">{value}</p>
    </div>
  </Card>
);

export default Index;
