import { useState, useMemo } from "react";
import { useStages, useLeads, useProfiles } from "@/hooks/useLeads";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { LeadFormDialog } from "@/components/crm/LeadFormDialog";
import { LeadDetailsSheet } from "@/components/crm/LeadDetailsSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, LogOut, Search, Loader2, Thermometer, DollarSign, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Lead } from "@/types/crm";
import { formatCurrency } from "@/lib/constants";
import { Card } from "@/components/ui/card";

const Index = () => {
  const { signOut, user } = useAuth();
  const stages = useStages();
  const leads = useLeads();
  const profiles = useProfiles();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [defaultStage, setDefaultStage] = useState<string | undefined>();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return leads.data ?? [];
    return (leads.data ?? []).filter((l) =>
      [l.company_or_person, l.contact_name, l.email, l.phone, l.city]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [leads.data, search]);

  const stats = useMemo(() => {
    const all = leads.data ?? [];
    const won = stages.data?.find((s) => s.is_won)?.id;
    const lost = stages.data?.find((s) => s.is_lost)?.id;
    const open = all.filter((l) => l.stage_id !== won && l.stage_id !== lost);
    const pipelineValue = open.reduce((s, l) => s + Number(l.estimated_value || 0), 0);
    const wonValue = all.filter((l) => l.stage_id === won).reduce((s, l) => s + Number(l.estimated_value || 0), 0);
    return { count: open.length, pipelineValue, wonValue };
  }, [leads.data, stages.data]);

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

  const loading = stages.isLoading || leads.isLoading;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-gradient-header text-primary-foreground shadow-card">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-accent rounded-lg p-1.5 shrink-0">
              <Building2 className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base md:text-lg leading-tight truncate">Valle Consultores</h1>
              <p className="text-[11px] text-primary-foreground/70 leading-tight truncate">CRM Comercial</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:block text-sm text-primary-foreground/80 truncate max-w-[200px]">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-primary-foreground hover:bg-white/10">
              <LogOut className="h-4 w-4 md:mr-1" />
              <span className="hidden md:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Stats + actions */}
      <div className="px-4 md:px-6 py-4 border-b bg-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">Funil comercial</h2>
            <p className="text-sm text-muted-foreground">Acompanhe e gerencie seus leads</p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar lead..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>
            <Button onClick={() => openNew()} className="shrink-0">
              <Plus className="h-4 w-4 mr-1" /> Novo lead
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Leads em aberto" value={String(stats.count)} />
          <StatCard icon={<DollarSign className="h-4 w-4" />} label="Pipeline" value={formatCurrency(stats.pipelineValue)} />
          <StatCard icon={<Thermometer className="h-4 w-4" />} label="Fechados" value={formatCurrency(stats.wonValue)} accent />
        </div>
      </div>

      {/* Kanban */}
      <main className="flex-1 overflow-hidden px-4 md:px-6 py-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

const StatCard = ({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) => (
  <Card className="p-3 flex items-center gap-3">
    <div className={`rounded-lg p-2 ${accent ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
      <p className="font-bold text-sm md:text-base truncate">{value}</p>
    </div>
  </Card>
);

export default Index;
