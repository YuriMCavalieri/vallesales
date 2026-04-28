import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useStages, useLeads } from "@/hooks/useLeads";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Building2, LogOut, LayoutDashboard, Kanban, Loader2,
  Users, DollarSign, TrendingUp, Trophy, XCircle, AlertTriangle, UserX, Target, Zap, Flame,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getLeadPriority, needsActionToday, isOverdue, isToday } from "@/lib/priority";

const stageColorVar: Record<string, string> = {
  novo_lead: "hsl(var(--stage-novo))",
  primeiro_contato: "hsl(var(--stage-primeiro))",
  reuniao_marcada: "hsl(var(--stage-reuniao))",
  proposta_enviada: "hsl(var(--stage-proposta))",
  em_negociacao: "hsl(var(--stage-negociacao))",
  fechado: "hsl(var(--stage-fechado))",
  perdido: "hsl(var(--stage-perdido))",
};

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const stages = useStages();
  const leads = useLeads();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const metrics = useMemo(() => {
    const allLeads = leads.data ?? [];
    const allStages = stages.data ?? [];
    const wonStage = allStages.find((s) => s.is_won);
    const lostStage = allStages.find((s) => s.is_lost);

    const wonLeads = allLeads.filter((l) => l.stage_id === wonStage?.id);
    const lostLeads = allLeads.filter((l) => l.stage_id === lostStage?.id);
    const openLeads = allLeads.filter(
      (l) => l.stage_id !== wonStage?.id && l.stage_id !== lostStage?.id
    );

    const pipelineValue = openLeads.reduce(
      (sum, l) => sum + Number(l.estimated_value || 0), 0
    );
    const wonValue = wonLeads.reduce(
      (sum, l) => sum + Number(l.estimated_value || 0), 0
    );
    const totalValue = allLeads.reduce(
      (sum, l) => sum + Number(l.estimated_value || 0), 0
    );

    const noContactCount = openLeads.filter((l) => !l.has_been_contacted).length;
    const overdueCount = openLeads.filter((l) => {
      if (!l.next_follow_up) return false;
      const d = new Date(l.next_follow_up);
      d.setHours(0, 0, 0, 0);
      return d.getTime() < today.getTime();
    }).length;

    const conversionRate = allLeads.length > 0
      ? (wonLeads.length / allLeads.length) * 100
      : 0;

    const byStage = allStages.map((s) => {
      const stageLeads = allLeads.filter((l) => l.stage_id === s.id);
      return {
        id: s.id,
        key: s.key,
        name: s.name,
        count: stageLeads.length,
        value: stageLeads.reduce((sum, l) => sum + Number(l.estimated_value || 0), 0),
        color: stageColorVar[s.key] || "hsl(var(--muted-foreground))",
      };
    });

    return {
      total: allLeads.length,
      wonCount: wonLeads.length,
      lostCount: lostLeads.length,
      openCount: openLeads.length,
      pipelineValue,
      wonValue,
      totalValue,
      noContactCount,
      overdueCount,
      conversionRate,
      byStage,
    };
  }, [leads.data, stages.data, today]);

  const loading = stages.isLoading || leads.isLoading;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-gradient-header text-primary-foreground shadow-sm border-b border-primary/20">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-accent rounded-lg p-2 shrink-0 shadow-sm">
              <Building2 className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base md:text-lg leading-tight truncate tracking-tight">
                Valle Consultores
              </h1>
              <p className="text-[11px] text-primary-foreground/70 leading-tight truncate uppercase tracking-wider font-medium">
                CRM Comercial
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground h-8">
                <Kanban className="h-4 w-4 md:mr-1.5" />
                <span className="hidden md:inline">Funil</span>
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="bg-white/10 text-primary-foreground hover:bg-white/15 h-8">
                <LayoutDashboard className="h-4 w-4 md:mr-1.5" />
                <span className="hidden md:inline">Dashboard</span>
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden md:block text-sm text-primary-foreground/80 truncate max-w-[200px]">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
              <LogOut className="h-4 w-4 md:mr-1" />
              <span className="hidden md:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Title */}
      <div className="px-4 md:px-6 py-5 border-b border-border bg-card">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
          Dashboard Comercial
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visão geral do pipeline e performance — dados em tempo real
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : (
        <main className="flex-1 px-4 md:px-6 py-6 space-y-6">
          {/* KPIs principais */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Indicadores principais
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <KpiCard tone="primary" icon={<Users className="h-4 w-4" />}
                label="Total de leads" value={String(metrics.total)} />
              <KpiCard tone="accent" icon={<DollarSign className="h-4 w-4" />}
                label="Valor do pipeline" value={formatCurrency(metrics.pipelineValue)}
                hint={`${metrics.openCount} em aberto`} />
              <KpiCard tone="success" icon={<Trophy className="h-4 w-4" />}
                label="Ganhos" value={String(metrics.wonCount)}
                hint={formatCurrency(metrics.wonValue)} />
              <KpiCard tone="muted" icon={<XCircle className="h-4 w-4" />}
                label="Perdidos" value={String(metrics.lostCount)} />
              <KpiCard tone="success" icon={<Target className="h-4 w-4" />}
                label="Taxa de conversão"
                value={`${metrics.conversionRate.toFixed(1)}%`}
                hint={`${metrics.wonCount} de ${metrics.total}`} />
              <KpiCard tone={metrics.overdueCount > 0 ? "danger" : "muted"}
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Follow-up atrasado" value={String(metrics.overdueCount)} />
              <KpiCard tone={metrics.noContactCount > 0 ? "warning" : "muted"}
                icon={<UserX className="h-4 w-4" />}
                label="Sem contato" value={String(metrics.noContactCount)} />
              <KpiCard tone="primary" icon={<TrendingUp className="h-4 w-4" />}
                label="Valor total"
                value={formatCurrency(metrics.totalValue)}
                hint="pipeline + ganhos + perdidos" />
            </div>
          </section>

          {/* Gráficos */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Leads por etapa</h3>
                  <p className="text-xs text-muted-foreground">Distribuição quantitativa do funil</p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.byStage} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false} axisLine={false} interval={0}
                      angle={-15} textAnchor="end" height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false} axisLine={false} allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                      formatter={(v: number) => [`${v} lead(s)`, "Quantidade"]}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {metrics.byStage.map((s) => (
                        <Cell key={s.id} fill={s.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Valor por etapa</h3>
                  <p className="text-xs text-muted-foreground">Distribuição financeira do funil</p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.byStage.filter((s) => s.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {metrics.byStage.filter((s) => s.value > 0).map((s) => (
                        <Cell key={s.id} fill={s.color} stroke="hsl(var(--card))" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [formatCurrency(v), "Valor"]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>

          {/* Tabela detalhada por etapa */}
          <section>
            <Card className="overflow-hidden">
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold text-sm text-foreground">Detalhamento por etapa</h3>
                <p className="text-xs text-muted-foreground">Quantidade e valor agregado em cada etapa do funil</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-left font-semibold uppercase text-[11px] tracking-wider px-5 py-2.5">Etapa</th>
                      <th className="text-right font-semibold uppercase text-[11px] tracking-wider px-5 py-2.5">Leads</th>
                      <th className="text-right font-semibold uppercase text-[11px] tracking-wider px-5 py-2.5">% do total</th>
                      <th className="text-right font-semibold uppercase text-[11px] tracking-wider px-5 py-2.5">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.byStage.map((s) => {
                      const pct = metrics.total > 0 ? (s.count / metrics.total) * 100 : 0;
                      return (
                        <tr key={s.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                              <span className="font-medium text-foreground">{s.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums font-semibold text-foreground">
                            {s.count}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                            {pct.toFixed(1)}%
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums font-semibold text-foreground">
                            {formatCurrency(s.value)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t-2 border-border">
                    <tr>
                      <td className="px-5 py-3 font-bold text-foreground uppercase text-xs tracking-wider">Total</td>
                      <td className="px-5 py-3 text-right tabular-nums font-bold text-foreground">{metrics.total}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">100%</td>
                      <td className="px-5 py-3 text-right tabular-nums font-bold text-foreground">
                        {formatCurrency(metrics.totalValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </section>
        </main>
      )}
    </div>
  );
};

const toneStyles: Record<string, string> = {
  primary: "bg-primary/8 text-primary",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

const KpiCard = ({
  icon, label, value, hint, tone = "primary",
}: {
  icon: React.ReactNode; label: string; value: string; hint?: string;
  tone?: "primary" | "accent" | "success" | "warning" | "danger" | "muted";
}) => (
  <Card className="p-4 border-border/70 shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all duration-200">
    <div className="flex items-start gap-3">
      <div className={cn("rounded-lg p-2.5 shrink-0", toneStyles[tone])}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium truncate">
          {label}
        </p>
        <p className="font-bold text-lg md:text-xl tabular-nums text-foreground leading-tight mt-0.5 truncate">
          {value}
        </p>
        {hint && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate tabular-nums">{hint}</p>
        )}
      </div>
    </div>
  </Card>
);

export default Dashboard;
