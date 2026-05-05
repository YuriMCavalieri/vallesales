import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeads, useStages } from "@/hooks/useLeads";
import type { Lead } from "@/types/crm";
import { Building2, Loader2, Mail, Phone, Search, Users, X } from "lucide-react";

type ContactSituation = "open" | "lost" | "won";
type SituationFilter = "all" | ContactSituation;

type ContactRow = {
  id: string;
  contactName: string;
  company: string;
  phone: string | null;
  email: string | null;
  situation: ContactSituation;
  leadCount: number;
  updatedAt: string;
};

const situationLabels: Record<ContactSituation, string> = {
  open: "Em aberto",
  lost: "Perdido",
  won: "Cliente",
};

const situationStyles: Record<ContactSituation, string> = {
  open: "bg-accent/10 text-accent border-accent/25",
  lost: "bg-destructive/10 text-destructive border-destructive/25",
  won: "bg-success/10 text-success border-success/25",
};

const normalizeText = (value?: string | null) => (value ?? "").trim().toLowerCase();
const normalizePhone = (value?: string | null) => (value ?? "").replace(/\D/g, "");

const getContactKey = (lead: Lead) => {
  const emailKey = normalizeText(lead.email);
  if (emailKey) return `email:${emailKey}`;

  const phoneKey = normalizePhone(lead.phone);
  if (phoneKey) return `phone:${phoneKey}`;

  const nameKey = normalizeText(lead.contact_name);
  const companyKey = normalizeText(lead.company_or_person);
  if (nameKey && companyKey) return `name-company:${nameKey}|${companyKey}`;
  if (nameKey) return `name:${nameKey}`;

  return `lead:${lead.id}`;
};

const pickPreferred = (...values: Array<string | null | undefined>) =>
  values.find((value) => typeof value === "string" && value.trim()) ?? null;

const compareDatesDesc = (left?: string | null, right?: string | null) =>
  new Date(right ?? 0).getTime() - new Date(left ?? 0).getTime();

const classifySituation = (leads: Lead[], wonStageId?: string, lostStageId?: string): ContactSituation => {
  const hasOpen = leads.some((lead) => lead.stage_id !== wonStageId && lead.stage_id !== lostStageId);
  if (hasOpen) return "open";

  const hasWon = leads.some((lead) => lead.stage_id === wonStageId);
  if (hasWon) return "won";

  return "lost";
};

const Contacts = () => {
  const leads = useLeads();
  const stages = useStages();
  const [search, setSearch] = useState("");
  const [situationFilter, setSituationFilter] = useState<SituationFilter>("all");

  const rows = useMemo(() => {
    const wonStageId = stages.data?.find((stage) => stage.is_won)?.id;
    const lostStageId = stages.data?.find((stage) => stage.is_lost)?.id;
    const grouped = new Map<string, Lead[]>();

    (leads.data ?? []).forEach((lead) => {
      const key = getContactKey(lead);
      const current = grouped.get(key) ?? [];
      current.push(lead);
      grouped.set(key, current);
    });

    return Array.from(grouped.entries())
      .map(([key, contactLeads]) => {
        const ordered = [...contactLeads].sort((left, right) =>
          compareDatesDesc(left.updated_at, right.updated_at) || compareDatesDesc(left.created_at, right.created_at)
        );
        const latest = ordered[0];

        return {
          id: key,
          contactName: pickPreferred(
            ...ordered.map((lead) => lead.contact_name),
            latest.company_or_person,
            "Sem nome"
          ) as string,
          company: pickPreferred(...ordered.map((lead) => lead.company_or_person), "Sem empresa") as string,
          phone: pickPreferred(...ordered.map((lead) => lead.phone)),
          email: pickPreferred(...ordered.map((lead) => lead.email)),
          situation: classifySituation(contactLeads, wonStageId, lostStageId),
          leadCount: contactLeads.length,
          updatedAt: latest.updated_at ?? latest.created_at,
        } satisfies ContactRow;
      })
      .sort((left, right) => compareDatesDesc(left.updatedAt, right.updatedAt));
  }, [leads.data, stages.data]);

  const filteredRows = useMemo(() => {
    const query = normalizeText(search);
    return rows.filter((row) => {
      if (situationFilter !== "all" && row.situation !== situationFilter) return false;

      if (!query) return true;
      const haystack = [
        row.contactName,
        row.company,
        row.phone,
        row.email,
        situationLabels[row.situation],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [rows, search, situationFilter]);

  const loading = leads.isLoading || stages.isLoading;
  const error = (leads.error as Error | null) ?? (stages.error as Error | null);
  const hasActiveFilters = !!search.trim() || situationFilter !== "all";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader active="contatos" />

      <div className="border-b border-border bg-card px-4 py-5 md:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
              Contatos
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Lista consolidada dos contatos ja relacionados aos negocios do funil.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Total" value={String(rows.length)} icon={<Users className="h-4 w-4" />} />
            <StatCard
              label="Em aberto"
              value={String(rows.filter((row) => row.situation === "open").length)}
              icon={<Building2 className="h-4 w-4" />}
            />
            <StatCard
              label="Clientes"
              value={String(rows.filter((row) => row.situation === "won").length)}
              icon={<Mail className="h-4 w-4" />}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, empresa, telefone ou e-mail..."
              className="h-9 bg-background pl-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <Select value={situationFilter} onValueChange={(value) => setSituationFilter(value as SituationFilter)}>
            <SelectTrigger className="h-9 bg-background md:w-52">
              <SelectValue placeholder="Situacao" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Em aberto</SelectItem>
              <SelectItem value="lost">Perdido</SelectItem>
              <SelectItem value="won">Cliente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 text-xs text-muted-foreground">
            {filteredRows.length} contato(s) encontrado(s)
          </div>
        )}
      </div>

      <main className="flex-1 px-4 py-6 md:px-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : error ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
            <X className="h-8 w-8 text-destructive" />
            <h3 className="text-lg font-semibold text-foreground">Nao foi possivel carregar os contatos</h3>
            <p className="text-sm text-muted-foreground">
              {error.message || "Erro ao carregar os dados do funil."}
            </p>
          </div>
        ) : filteredRows.length === 0 ? (
          <Card className="mx-auto max-w-2xl p-8 text-center">
            <h3 className="text-lg font-semibold text-foreground">Nenhum contato encontrado</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ajuste os filtros ou cadastre novos leads no funil para ver contatos aqui.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Nome</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Empresa</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Telefone</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">E-mail</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Situacao</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-muted/20 last:border-0">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{row.contactName}</p>
                          {row.leadCount > 1 && (
                            <p className="text-xs text-muted-foreground">{row.leadCount} negocios relacionados</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">{row.company}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.phone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" />
                            {row.phone}
                          </span>
                        ) : (
                          "Nao informado"
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.email ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" />
                            {row.email}
                          </span>
                        ) : (
                          "Nao informado"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={situationStyles[row.situation]}>
                          {situationLabels[row.situation]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) => (
  <Card className="flex items-center gap-3 p-3">
    <div className="rounded-lg bg-accent/10 p-2 text-accent">{icon}</div>
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  </Card>
);

export default Contacts;
