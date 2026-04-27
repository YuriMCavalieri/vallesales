import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateLead, useProfiles, useStages, useUpdateLead } from "@/hooks/useLeads";
import { Lead } from "@/types/crm";
import { CONTACT_METHOD_OPTIONS, SOURCE_OPTIONS, TEMPERATURE_OPTIONS, UF_OPTIONS } from "@/lib/constants";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead?: Lead | null;
  defaultStageId?: string;
}

export const LeadFormDialog = ({ open, onOpenChange, lead, defaultStageId }: Props) => {
  const { data: stages = [] } = useStages();
  const { data: profiles = [] } = useProfiles();
  const create = useCreateLead();
  const update = useUpdateLead();

  const [form, setForm] = useState({
    company_or_person: "", contact_name: "", phone: "", email: "",
    source: "", segment: "", city: "", uf: "",
    owner_id: "", estimated_value: "0",
    temperature: "morno", stage_id: "",
    has_been_contacted: false, contact_method: "",
    next_follow_up: "", notes: "",
  });

  useEffect(() => {
    if (lead) {
      setForm({
        company_or_person: lead.company_or_person ?? "",
        contact_name: lead.contact_name ?? "",
        phone: lead.phone ?? "", email: lead.email ?? "",
        source: lead.source ?? "", segment: lead.segment ?? "",
        city: lead.city ?? "", uf: lead.uf ?? "",
        owner_id: lead.owner_id ?? "",
        estimated_value: String(lead.estimated_value ?? 0),
        temperature: lead.temperature, stage_id: lead.stage_id,
        has_been_contacted: lead.has_been_contacted,
        contact_method: lead.contact_method ?? "",
        next_follow_up: lead.next_follow_up ?? "",
        notes: lead.notes ?? "",
      });
    } else {
      setForm((f) => ({
        ...f,
        company_or_person: "", contact_name: "", phone: "", email: "",
        source: "", segment: "", city: "", uf: "",
        owner_id: "", estimated_value: "0",
        temperature: "morno",
        stage_id: defaultStageId || stages[0]?.id || "",
        has_been_contacted: false, contact_method: "",
        next_follow_up: "", notes: "",
      }));
    }
  }, [lead, open, defaultStageId, stages]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_or_person.trim()) return;
    const payload = {
      company_or_person: form.company_or_person.trim(),
      contact_name: form.contact_name || null,
      phone: form.phone || null,
      email: form.email || null,
      source: form.source || null,
      segment: form.segment || null,
      city: form.city || null,
      uf: form.uf || null,
      owner_id: form.owner_id || null,
      estimated_value: Number(form.estimated_value) || 0,
      temperature: form.temperature as "frio" | "morno" | "quente",
      stage_id: form.stage_id,
      has_been_contacted: form.has_been_contacted,
      contact_method: (form.contact_method || null) as never,
      next_follow_up: form.next_follow_up || null,
      notes: form.notes || null,
    };
    if (lead) {
      await update.mutateAsync({ id: lead.id, ...payload });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const loading = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar lead" : "Novo lead"}</DialogTitle>
          <DialogDescription>Preencha as informações do lead</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Empresa ou pessoa *</Label>
              <Input value={form.company_or_person} onChange={(e) => setForm({ ...form, company_or_person: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Contato principal</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Origem do lead</Label>
              <Select value={form.source || undefined} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{SOURCE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Segmento</Label>
              <Input value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Select value={form.uf || undefined} onValueChange={(v) => setForm({ ...form, uf: v })}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UF_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={form.owner_id || undefined} onValueChange={(v) => setForm({ ...form, owner_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor estimado (R$)</Label>
              <Input type="number" step="0.01" min="0" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Temperatura</Label>
              <Select value={form.temperature} onValueChange={(v) => setForm({ ...form, temperature: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TEMPERATURE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Etapa do funil</Label>
              <Select value={form.stage_id} onValueChange={(v) => setForm({ ...form, stage_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Próximo follow-up</Label>
              <Input type="date" value={form.next_follow_up} onChange={(e) => setForm({ ...form, next_follow_up: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Forma de contato</Label>
              <Select value={form.contact_method || undefined} onValueChange={(v) => setForm({ ...form, contact_method: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{CONTACT_METHOD_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-7">
              <Switch checked={form.has_been_contacted} onCheckedChange={(c) => setForm({ ...form, has_been_contacted: c })} />
              <Label className="cursor-pointer">Já houve contato?</Label>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {lead ? "Salvar" : "Criar lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
