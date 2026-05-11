import { useMemo, useState } from "react";
import { z } from "zod";
import { Building2, CheckCircle2, ChevronDown, Loader2, Send } from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone, isValidLeadPhone, SERVICE_TYPE_OPTIONS } from "@/lib/lead-form";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const publicLeadSchema = z.object({
  contact_name: z.string().trim().min(2, "Informe o nome do contato."),
  company_or_person: z.string().trim().min(2, "Informe a empresa ou pessoa."),
  service_types: z.array(z.string()).min(1, "Selecione ao menos um serviço."),
  phone: z.string().trim(),
  email: z.string().trim().email("Informe um e-mail válido."),
  employee_count: z.string().trim().min(1, "Informe quantos funcionários você possui."),
  notes: z.string().trim().min(2, "Informe sua mensagem ou observações."),
  hp_field: z.string().trim().max(0, "Campo inválido."),
});

type FormState = {
  contact_name: string;
  company_or_person: string;
  service_types: string[];
  phone: string;
  email: string;
  employee_count: string;
  notes: string;
  hp_field: string;
};

const initialForm: FormState = {
  contact_name: "",
  company_or_person: "",
  service_types: [],
  phone: "",
  email: "",
  employee_count: "",
  notes: "",
  hp_field: "",
};

const PublicLeadForm = () => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);

  const utmContext = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_term: params.get("utm_term"),
      utm_content: params.get("utm_content"),
      landing_path: `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer || null,
    };
  }, []);

  const patchForm = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const toggleServiceType = (serviceType: string, checked: boolean) => {
    patchForm({
      service_types: checked
        ? Array.from(new Set([...form.service_types, serviceType]))
        : form.service_types.filter((item) => item !== serviceType),
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsed = publicLeadSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revise os campos do formulário.");
      return;
    }

    if (!isValidLeadPhone(form.phone)) {
      toast.error("Informe um telefone válido.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.functions.invoke("public-lead-intake", {
      body: {
        contact_name: form.contact_name.trim(),
        company_or_person: form.company_or_person.trim(),
        service_types: form.service_types,
        phone: formatPhone(form.phone),
        email: form.email.trim(),
        employee_count: form.employee_count.trim(),
        notes: form.notes.trim(),
        source: "Formulario site",
        hp_field: form.hp_field,
        ...utmContext,
      },
    });

    setLoading(false);

    if (error) {
      if (error instanceof FunctionsHttpError) {
        try {
          const payload = await error.context.json();
          toast.error(String(payload?.error || "Não foi possível enviar seu contato."));
          return;
        } catch {
          toast.error("Não foi possível enviar seu contato.");
          return;
        }
      }

      toast.error(error.message || "Não foi possível enviar seu contato.");
      return;
    }

    if (data?.error) {
      toast.error(String(data.error));
      return;
    }

    setSubmitted(true);
    setForm(initialForm);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-header px-4 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_55%)]" />
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="text-header-foreground">
          <div className="mb-6 inline-flex rounded-2xl bg-white/10 p-3 shadow-elevated backdrop-blur">
            <Building2 className="h-8 w-8" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-header-muted">Valle | Consultores</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Proposta sob medida para sua empresa
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-header-muted sm:text-lg">
            Preencha o formulário e conte um pouco sobre seu negócio. Nossa equipe analisará seu cenário e entrará em contato com uma proposta alinhada às suas necessidades.
          </p>
        </section>

        <Card className="border-0 shadow-elevated">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Solicite contato</CardTitle>
            <CardDescription>
              Envie seus dados e nosso time comercial entrará em contato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="rounded-2xl border border-success/20 bg-success/5 p-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                <h2 className="mt-4 text-lg font-semibold text-foreground">Contato enviado com sucesso</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Seu lead foi registrado. Em breve nossa equipe deve entrar em contato.
                </p>
                <Button type="button" variant="outline" className="mt-5" onClick={() => setSubmitted(false)}>
                  Enviar outro contato
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-2">
                  <Label htmlFor="public-contact">Qual o seu nome?</Label>
                  <Input
                    id="public-contact"
                    value={form.contact_name}
                    onChange={(event) => patchForm({ contact_name: event.target.value })}
                    placeholder="Digite seu nome"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="public-company">Qual o nome da sua empresa?</Label>
                  <Input
                    id="public-company"
                    value={form.company_or_person}
                    onChange={(event) => patchForm({ company_or_person: event.target.value })}
                    placeholder="Digite sua empresa"
                    autoComplete="organization"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Qual serviço você está buscando?</Label>
                  <Popover open={servicePickerOpen} onOpenChange={setServicePickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background transition-colors",
                          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          form.service_types.length === 0 && "text-muted-foreground",
                        )}
                      >
                        <span className="pr-3">
                          {form.service_types.length > 0
                            ? form.service_types.join(", ")
                            : "Clique para selecionar os serviços"}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
                      <div className="space-y-1">
                        {SERVICE_TYPE_OPTIONS.map((serviceType) => {
                          const checked = form.service_types.includes(serviceType);
                          return (
                            <label
                              key={serviceType}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-md border border-transparent px-2 py-2 hover:border-border hover:bg-muted/40",
                                checked && "border-accent/30 bg-accent/5",
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => toggleServiceType(serviceType, Boolean(value))}
                              />
                              <span className="text-sm text-foreground">{serviceType}</span>
                            </label>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="public-phone">Qual o seu telefone?</Label>
                    <Input
                      id="public-phone"
                      value={form.phone}
                      onChange={(event) => patchForm({ phone: formatPhone(event.target.value) })}
                      placeholder="Insira seu telefone"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="public-email">Qual o seu e-mail?</Label>
                    <Input
                      id="public-email"
                      type="email"
                      value={form.email}
                      onChange={(event) => patchForm({ email: event.target.value })}
                      placeholder="Digite seu e-mail"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="public-employees">Quantos funcionários você possui?</Label>
                  <Input
                    id="public-employees"
                    value={form.employee_count}
                    onChange={(event) => patchForm({ employee_count: event.target.value })}
                    placeholder="Digite a quantidade"
                    inputMode="numeric"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="public-notes">Mensagem / Observações</Label>
                  <Textarea
                    id="public-notes"
                    rows={5}
                    value={form.notes}
                    onChange={(event) => patchForm({ notes: event.target.value })}
                    placeholder="Conte um pouco sobre o que sua empresa precisa."
                    required
                  />
                </div>

                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                  value={form.hp_field}
                  onChange={(event) => patchForm({ hp_field: event.target.value })}
                />

                <Button type="submit" variant="accent" className="w-full font-semibold" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Enviar contato
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicLeadForm;
