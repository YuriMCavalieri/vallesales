import { useState, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lead, Profile, PipelineStage } from "@/types/crm";
import {
  useLeadActivities, useLeadNotes, useLeadAttachments,
  useAddNote, useLogContact, useUploadAttachment, downloadAttachment, useDeleteLead,
  useUpdateLead,
} from "@/hooks/useLeads";
import { useAuth } from "@/hooks/useAuth";
import { CONTACT_METHOD_OPTIONS, formatCurrency, formatDate, formatDateTime } from "@/lib/constants";
import {
  Phone, Mail, MapPin, User as UserIcon, DollarSign, Calendar,
  MessageSquarePlus, PhoneCall, Paperclip, Download, Pencil, Trash2,
  History, FileText, FileUp, Loader2,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

interface Props {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profiles: Profile[];
  stages: PipelineStage[];
  onEdit: () => void;
}

const tempColors: Record<string, string> = {
  frio: "bg-temp-frio/10 text-temp-frio border-temp-frio/30",
  morno: "bg-temp-morno/10 text-temp-morno border-temp-morno/30",
  quente: "bg-temp-quente/10 text-temp-quente border-temp-quente/30",
};
const tempLabel: Record<string, string> = { frio: "Frio", morno: "Morno", quente: "Quente" };

const activityLabel: Record<string, string> = {
  stage_change: "Mudança de etapa",
  owner_change: "Mudança de responsável",
  note_added: "Observação",
  contact_logged: "Contato realizado",
  attachment_added: "Anexo",
  lead_created: "Lead criado",
  lead_updated: "Atualização",
};

export const LeadDetailsSheet = ({ lead, open, onOpenChange, profiles, stages, onEdit }: Props) => {
  const [newNote, setNewNote] = useState("");
  const [contactMethod, setContactMethod] = useState("whatsapp");
  const [contactDesc, setContactDesc] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const activities = useLeadActivities(lead?.id ?? null);
  const notes = useLeadNotes(lead?.id ?? null);
  const attachments = useLeadAttachments(lead?.id ?? null);
  const addNote = useAddNote(lead?.id ?? "");
  const logContact = useLogContact(lead?.id ?? "");
  const upload = useUploadAttachment(lead?.id ?? "");
  const del = useDeleteLead();
  const updateLead = useUpdateLead();
  const { user } = useAuth();

  if (!lead) return null;
  const owner = profiles.find((p) => p.id === lead.owner_id);
  const stage = stages.find((s) => s.id === lead.stage_id);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await addNote.mutateAsync(newNote.trim());
    setNewNote("");
  };

  const handleLogContact = async () => {
    await logContact.mutateAsync({ method: contactMethod, description: contactDesc });
    setContactDesc("");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await upload.mutateAsync(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async () => {
    if (!confirm("Excluir este lead permanentemente?")) return;
    await del.mutateAsync(lead.id);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <div className="bg-gradient-header text-primary-foreground p-6">
          <SheetHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="text-primary-foreground text-xl truncate">{lead.company_or_person}</SheetTitle>
                {lead.contact_name && <SheetDescription className="text-primary-foreground/80">{lead.contact_name}</SheetDescription>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-foreground hover:bg-white/10" onClick={onEdit}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-foreground hover:bg-destructive/30" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {stage && <Badge variant="secondary">{stage.name}</Badge>}
              <Badge variant="outline" className={`${tempColors[lead.temperature]} border`}>{tempLabel[lead.temperature]}</Badge>
              {lead.has_been_contacted && <Badge variant="outline" className="bg-success/20 text-success-foreground border-success/30">Contatado</Badge>}
            </div>
          </SheetHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {lead.phone && <Info icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={lead.phone} />}
            {lead.email && <Info icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" value={lead.email} />}
            {(lead.city || lead.uf) && <Info icon={<MapPin className="h-3.5 w-3.5" />} label="Localização" value={[lead.city, lead.uf].filter(Boolean).join(" / ")} />}
            {owner && <Info icon={<UserIcon className="h-3.5 w-3.5" />} label="Responsável" value={owner.full_name || owner.email || ""} />}
            {Number(lead.estimated_value) > 0 && <Info icon={<DollarSign className="h-3.5 w-3.5" />} label="Valor" value={formatCurrency(Number(lead.estimated_value))} />}
            {lead.next_follow_up && <Info icon={<Calendar className="h-3.5 w-3.5" />} label="Próximo follow-up" value={formatDate(lead.next_follow_up)} />}
            {lead.source && <Info label="Origem" value={lead.source} />}
            {lead.segment && <Info label="Segmento" value={lead.segment} />}
          </div>

          {lead.notes && (
            <Card className="p-3 bg-secondary/40 border-0 text-sm whitespace-pre-wrap">{lead.notes}</Card>
          )}

          <Separator />

          <Tabs defaultValue="history">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" />Histórico</TabsTrigger>
              <TabsTrigger value="notes"><FileText className="h-3.5 w-3.5 mr-1" />Observações</TabsTrigger>
              <TabsTrigger value="files"><Paperclip className="h-3.5 w-3.5 mr-1" />Anexos</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-4 space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2"><PhoneCall className="h-4 w-4" /> Registrar contato</h4>
                <div className="flex gap-2">
                  <Select value={contactMethod} onValueChange={setContactMethod}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTACT_METHOD_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Textarea rows={1} placeholder="Descrição (opcional)" value={contactDesc} onChange={(e) => setContactDesc(e.target.value)} className="flex-1 min-h-9" />
                  <Button size="sm" onClick={handleLogContact} disabled={logContact.isPending}>
                    {logContact.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Registrar
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Linha do tempo</h4>
                {activities.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : activities.data?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma atividade.</p>
                ) : (
                  <div className="space-y-2">
                    {activities.data?.map((a) => (
                      <div key={a.id} className="flex gap-3 text-sm border-l-2 border-accent pl-3 py-1">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs text-muted-foreground">{activityLabel[a.type]}</p>
                          <p className="text-foreground">{a.description}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{formatDateTime(a.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-4 space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2"><MessageSquarePlus className="h-4 w-4" /> Nova observação</h4>
                <Textarea rows={3} placeholder="Escreva uma observação..." value={newNote} onChange={(e) => setNewNote(e.target.value)} />
                <Button size="sm" onClick={handleAddNote} disabled={addNote.isPending || !newNote.trim()}>
                  {addNote.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  Adicionar
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                {notes.data?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem observações.</p>
                ) : (
                  notes.data?.map((n) => (
                    <Card key={n.id} className="p-3 text-sm">
                      <p className="whitespace-pre-wrap">{n.content}</p>
                      <p className="text-[11px] text-muted-foreground mt-2">{formatDateTime(n.created_at)}</p>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="files" className="mt-4 space-y-4">
              <div>
                <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                  {upload.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileUp className="h-3.5 w-3.5 mr-1" />}
                  Enviar arquivo
                </Button>
              </div>
              <div className="space-y-2">
                {attachments.data?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem anexos.</p>
                ) : (
                  attachments.data?.map((a) => (
                    <Card key={a.id} className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.file_name}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(a.created_at)}</p>
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => downloadAttachment(a.file_path, a.file_name)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Info = ({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) => (
  <div className="space-y-0.5">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">{icon}{label}</p>
    <p className="text-sm font-medium text-foreground break-words">{value}</p>
  </div>
);
