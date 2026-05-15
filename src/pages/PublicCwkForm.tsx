import { useMemo, useState } from "react";
import { z } from "zod";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatCnpj, formatPhone, isValidLeadPhone } from "@/lib/lead-form";
import { UF_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CWK_UNIT_OPTIONS = [
  { value: "CWK Lourdes", label: "CWK Lourdes" },
  { value: "CWK Savassi", label: "CWK Savassi" },
  { value: "CWK Santa Efigenia", label: "CWK Santa Efigenia" },
] as const;

const CWK_PLAN_OPTIONS = [
  { value: "virtual_fiscal", label: "Virtual Fiscal", serviceType: "Coworking - EscritÃ³rio Virtual" },
  { value: "virtual_full", label: "Virtual Full", serviceType: "Coworking - EscritÃ³rio Virtual" },
  { value: "part_time", label: "Part-time", serviceType: "Coworking - EstaÃ§Ã£o Compartilhada" },
  { value: "full_time", label: "Full-time", serviceType: "Coworking - EstaÃ§Ã£o Compartilhada" },
  { value: "private", label: "Private", serviceType: "Coworking - Sala Privativa" },
  { value: "meeting_room", label: "Sala de Reuniao", serviceType: "Coworking - Salas de ReuniÃ£o" },
] as const;

const yesNoOptions = [
  { value: "Sim", label: "Sim" },
  { value: "Nao", label: "Nao" },
] as const;

const legalRepresentativeSchema = z.object({
  name: z.string().trim(),
  rg: z.string().trim(),
  cpf: z.string().trim(),
  address: z.string().trim(),
  neighborhood: z.string().trim(),
  city: z.string().trim(),
  uf: z.string().trim(),
  cep: z.string().trim(),
  birth_date: z.string().trim(),
  email: z.string().trim(),
  phone: z.string().trim(),
});

const simpleContactSchema = z.object({
  name: z.string().trim(),
  phones: z.string().trim(),
  emails: z.string().trim(),
});

const stepOneSchema = z.object({
  unit: z.string().trim().min(1, "Selecione a unidade da CWK."),
  plan: z.string().trim().min(1, "Selecione o plano desejado."),
  company_or_person: z.string().trim().min(2, "Informe a razao social."),
  trade_name: z.string().trim().min(2, "Informe o nome fantasia."),
  main_activity: z.string().trim().min(2, "Informe a atividade principal."),
  cnpj: z.string().trim().min(14, "Informe o CNPJ da empresa."),
  hp_field: z.string().trim().max(0, "Campo invalido."),
});

const stepTwoSchema = z.object({
  address: z.string().trim().min(5, "Informe o endereco da empresa."),
  neighborhood: z.string().trim().min(2, "Informe o bairro."),
  city: z.string().trim().min(2, "Informe a cidade."),
  uf: z.string().trim().min(2, "Selecione a UF."),
  cep: z.string().trim().min(8, "Informe o CEP."),
  company_phone: z.string().trim(),
  company_email: z.string().trim().email("Informe um e-mail valido da empresa."),
  retains_issqn: z.string().trim().min(1, "Informe se a empresa retem ISSQN."),
  contract_change_interest: z.string().trim().min(1, "Informe se ha interesse em abertura ou alteracao contratual."),
});

const stepThreeSchema = z.object({
  representative_one: legalRepresentativeSchema.superRefine((value, ctx) => {
    if (!value.name) ctx.addIssue({ code: "custom", message: "Informe o nome do representante legal principal." });
    if (!value.cpf) ctx.addIssue({ code: "custom", message: "Informe o CPF do representante legal principal." });
    if (!value.email) ctx.addIssue({ code: "custom", message: "Informe o e-mail do representante legal principal." });
    if (!value.phone) ctx.addIssue({ code: "custom", message: "Informe o telefone do representante legal principal." });
  }),
  representative_two: legalRepresentativeSchema,
});

const stepFourSchema = z.object({
  message_contact_name: z.string().trim(),
  message_contact_email: z.string().trim(),
  message_contact_phone: z.string().trim(),
  financial_contact: simpleContactSchema,
  commercial_contact: simpleContactSchema.superRefine((value, ctx) => {
    if (!value.name) ctx.addIssue({ code: "custom", message: "Informe o nome do contato comercial." });
    if (!value.phones) ctx.addIssue({ code: "custom", message: "Informe o telefone do contato comercial." });
    if (!value.emails) ctx.addIssue({ code: "custom", message: "Informe o e-mail do contato comercial." });
  }),
  notes: z.string().trim(),
});

type LegalRepresentativeForm = z.infer<typeof legalRepresentativeSchema>;
type SimpleContactForm = z.infer<typeof simpleContactSchema>;

type FormState = {
  unit: string;
  plan: string;
  company_or_person: string;
  trade_name: string;
  main_activity: string;
  cnpj: string;
  address: string;
  neighborhood: string;
  city: string;
  uf: string;
  cep: string;
  company_phone: string;
  company_email: string;
  state_registration: string;
  municipal_registration: string;
  retains_issqn: string;
  contract_change_interest: string;
  representative_one: LegalRepresentativeForm;
  representative_two: LegalRepresentativeForm;
  message_contact_name: string;
  message_contact_email: string;
  message_contact_phone: string;
  financial_contact: SimpleContactForm;
  commercial_contact: SimpleContactForm;
  notes: string;
  hp_field: string;
};

const emptyRepresentative = (): LegalRepresentativeForm => ({
  name: "",
  rg: "",
  cpf: "",
  address: "",
  neighborhood: "",
  city: "",
  uf: "",
  cep: "",
  birth_date: "",
  email: "",
  phone: "",
});

const emptyContact = (): SimpleContactForm => ({
  name: "",
  phones: "",
  emails: "",
});

const initialForm: FormState = {
  unit: "",
  plan: "",
  company_or_person: "",
  trade_name: "",
  main_activity: "",
  cnpj: "",
  address: "",
  neighborhood: "",
  city: "",
  uf: "",
  cep: "",
  company_phone: "",
  company_email: "",
  state_registration: "",
  municipal_registration: "",
  retains_issqn: "",
  contract_change_interest: "",
  representative_one: emptyRepresentative(),
  representative_two: emptyRepresentative(),
  message_contact_name: "",
  message_contact_email: "",
  message_contact_phone: "",
  financial_contact: emptyContact(),
  commercial_contact: emptyContact(),
  notes: "",
  hp_field: "",
};

const FieldLabel = ({
  children,
  htmlFor,
  required,
  optional,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
}) => (
  <Label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
    <span>{children}</span>
    {required ? <span className="text-destructive">*</span> : null}
    {optional ? <span className="text-xs font-normal text-muted-foreground">opcional</span> : null}
  </Label>
);

const digitsOnly = (value: string) => value.replace(/\D/g, "");

const formatCep = (value: string) => {
  const digits = digitsOnly(value).slice(0, 8);
  if (!digits) return "";
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const formatCpf = (value: string) => {
  const digits = digitsOnly(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const isValidCpf = (value: string) => digitsOnly(value).length === 11;

const splitFirstValue = (value: string) =>
  value
    .split(/\r?\n|,|;|\//)
    .map((item) => item.trim())
    .find(Boolean) ?? "";

const hasRepresentativeData = (representative: LegalRepresentativeForm) =>
  Object.values(representative).some((value) => value.trim());

const hasContactData = (contact: SimpleContactForm) =>
  Object.values(contact).some((value) => value.trim());

const formatRepresentativeBlock = (title: string, representative: LegalRepresentativeForm) => {
  if (!hasRepresentativeData(representative)) return null;

  return [
    title,
    `Nome: ${representative.name || "-"}`,
    `RG: ${representative.rg || "-"}`,
    `CPF: ${representative.cpf || "-"}`,
    `Data de nascimento: ${representative.birth_date || "-"}`,
    `Telefone: ${representative.phone || "-"}`,
    `E-mail: ${representative.email || "-"}`,
    `Endereco: ${representative.address || "-"}`,
    `Bairro: ${representative.neighborhood || "-"}`,
    `Cidade/UF: ${[representative.city, representative.uf].filter(Boolean).join("/") || "-"}`,
    `CEP: ${representative.cep || "-"}`,
  ].join("\n");
};

const formatSimpleContactBlock = (title: string, contact: SimpleContactForm) => {
  if (!hasContactData(contact)) return null;

  return [
    title,
    `Nome: ${contact.name || "-"}`,
    `Telefones: ${contact.phones || "-"}`,
    `E-mails: ${contact.emails || "-"}`,
  ].join("\n");
};

const PublicCwkForm = () => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  const selectedUnit = useMemo(
    () => CWK_UNIT_OPTIONS.find((item) => item.value === form.unit) ?? null,
    [form.unit],
  );
  const selectedPlan = useMemo(
    () => CWK_PLAN_OPTIONS.find((item) => item.value === form.plan) ?? null,
    [form.plan],
  );
  const progressPercentage = Math.round((step / 4) * 100);

  const patchForm = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const patchRepresentative = (
    key: "representative_one" | "representative_two",
    patch: Partial<LegalRepresentativeForm>,
  ) => {
    setForm((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch,
      },
    }));
  };

  const patchContact = (
    key: "financial_contact" | "commercial_contact",
    patch: Partial<SimpleContactForm>,
  ) => {
    setForm((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch,
      },
    }));
  };

  const validateStepOne = () => {
    const parsed = stepOneSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revise os campos desta etapa.");
      return false;
    }
    return true;
  };

  const validateStepTwo = () => {
    const parsed = stepTwoSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revise os campos desta etapa.");
      return false;
    }

    if (!isValidLeadPhone(form.company_phone)) {
      toast.error("Informe um telefone valido da empresa.");
      return false;
    }

    return true;
  };

  const validateStepThree = () => {
    const parsed = stepThreeSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revise os campos dos representantes legais.");
      return false;
    }

    if (!isValidCpf(form.representative_one.cpf)) {
      toast.error("Informe um CPF valido para o representante legal principal.");
      return false;
    }

    if (!isValidLeadPhone(form.representative_one.phone)) {
      toast.error("Informe um telefone valido para o representante legal principal.");
      return false;
    }

    const representativeTwoHasData = hasRepresentativeData(form.representative_two);
    if (representativeTwoHasData && form.representative_two.cpf && !isValidCpf(form.representative_two.cpf)) {
      toast.error("O CPF do segundo representante legal esta invalido.");
      return false;
    }

    if (representativeTwoHasData && form.representative_two.phone && !isValidLeadPhone(form.representative_two.phone)) {
      toast.error("O telefone do segundo representante legal esta invalido.");
      return false;
    }

    return true;
  };

  const validateStepFour = () => {
    const parsed = stepFourSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revise os contatos finais desta ficha.");
      return false;
    }

    const commercialPhone = splitFirstValue(form.commercial_contact.phones);
    if (!isValidLeadPhone(commercialPhone)) {
      toast.error("Informe um telefone valido para o contato comercial.");
      return false;
    }

    return true;
  };

  const goToNextStep = () => {
    if (step === 1 && !validateStepOne()) return;
    if (step === 2 && !validateStepTwo()) return;
    if (step === 3 && !validateStepThree()) return;
    setStep((current) => Math.min(current + 1, 4) as 1 | 2 | 3 | 4);
  };

  const goToPreviousStep = () => {
    setStep((current) => Math.max(current - 1, 1) as 1 | 2 | 3 | 4);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateStepOne() || !validateStepTwo() || !validateStepThree() || !validateStepFour()) {
      return;
    }

    if (!selectedUnit || !selectedPlan) {
      toast.error("Selecione unidade e plano antes de enviar.");
      return;
    }

    setLoading(true);

    const primaryCommercialPhone = splitFirstValue(form.commercial_contact.phones);
    const primaryCommercialEmail = splitFirstValue(form.commercial_contact.emails);

    const diagnosisBlocks = [
      [
        "Ficha cadastral CWK",
        `Unidade escolhida: ${selectedUnit.label}`,
        `Plano escolhido: ${selectedPlan.label}`,
        `Interesse em abertura de empresa ou alteracao contratual do endereco: ${form.contract_change_interest}`,
      ].join("\n"),
      [
        "Dados da empresa",
        `Razao social: ${form.company_or_person}`,
        `Nome fantasia: ${form.trade_name}`,
        `CNPJ: ${form.cnpj}`,
        `Atividade principal: ${form.main_activity}`,
        `Endereco: ${form.address}`,
        `Bairro: ${form.neighborhood}`,
        `Cidade/UF: ${form.city}/${form.uf}`,
        `CEP: ${form.cep}`,
        `Celular da empresa: ${form.company_phone}`,
        `E-mail da empresa: ${form.company_email}`,
        `Inscricao estadual: ${form.state_registration || "-"}`,
        `Inscricao municipal: ${form.municipal_registration || "-"}`,
        `Retem ISSQN: ${form.retains_issqn}`,
      ].join("\n"),
      formatRepresentativeBlock("Representante legal 1", form.representative_one),
      formatRepresentativeBlock("Representante legal 2", form.representative_two),
      form.message_contact_name || form.message_contact_email || form.message_contact_phone
        ? [
            "Atendimento / envio de recados",
            `Nome para atendimento: ${form.message_contact_name || "-"}`,
            `E-mail: ${form.message_contact_email || "-"}`,
            `Celular: ${form.message_contact_phone || "-"}`,
          ].join("\n")
        : null,
      formatSimpleContactBlock("Contato financeiro", form.financial_contact),
      formatSimpleContactBlock("Contato comercial", form.commercial_contact),
      form.notes.trim() ? ["Observacoes adicionais", form.notes.trim()].join("\n") : null,
    ].filter(Boolean);

    const additionalContacts = [
      {
        id: "cwk-representative-1",
        name: form.representative_one.name ? `Representante legal 1 - ${form.representative_one.name}` : "",
        phone: form.representative_one.phone,
        email: form.representative_one.email,
      },
      {
        id: "cwk-representative-2",
        name: form.representative_two.name ? `Representante legal 2 - ${form.representative_two.name}` : "",
        phone: form.representative_two.phone,
        email: form.representative_two.email,
      },
      {
        id: "cwk-financial-contact",
        name: form.financial_contact.name ? `Contato financeiro - ${form.financial_contact.name}` : "",
        phone: splitFirstValue(form.financial_contact.phones),
        email: splitFirstValue(form.financial_contact.emails),
      },
      {
        id: "cwk-message-contact",
        name: form.message_contact_name ? `Atendimento / recados - ${form.message_contact_name}` : "",
        phone: form.message_contact_phone,
        email: form.message_contact_email,
      },
    ].filter((contact) => contact.name || contact.phone || contact.email);

    const { data, error } = await supabase.functions.invoke("public-lead-intake", {
      body: {
        target_funnel_name: selectedUnit.value,
        company_maturity: "existing_company",
        company_or_person: form.company_or_person.trim(),
        contact_name: form.commercial_contact.name.trim(),
        service_types: [selectedPlan.serviceType],
        service_details: [
          `Plano escolhido: ${selectedPlan.label}`,
          `Unidade escolhida: ${selectedUnit.label}`,
          `Nome fantasia: ${form.trade_name.trim()}`,
        ].join("\n"),
        phone: formatPhone(primaryCommercialPhone),
        email: primaryCommercialEmail.trim(),
        cnpj: formatCnpj(form.cnpj),
        city: form.city.trim(),
        uf: form.uf,
        segment: "Coworking",
        segment_other: `${selectedUnit.label} | ${selectedPlan.label}`,
        source: "Ficha cadastral CWK",
        accounting_pain_points: diagnosisBlocks.join("\n\n"),
        additional_contacts: additionalContacts,
        notes: form.notes.trim(),
        hp_field: form.hp_field,
        ...utmContext,
      },
    });

    if (error) {
      setLoading(false);
      if (error instanceof FunctionsHttpError) {
        try {
          const payload = await error.context.json();
          toast.error(String(payload?.error || "Nao foi possivel enviar a ficha cadastral."));
          return;
        } catch {
          toast.error("Nao foi possivel enviar a ficha cadastral.");
          return;
        }
      }

      toast.error(error.message || "Nao foi possivel enviar a ficha cadastral.");
      return;
    }

    if (data?.error) {
      setLoading(false);
      toast.error(String(data.error));
      return;
    }

    setLoading(false);
    setSubmitted(true);
    setStep(1);
    setForm(initialForm);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#4f2878_0%,#5f338c_58%,#ff7f2a_130%)] px-4 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_52%)]" />
      <div className="pointer-events-none absolute -left-20 top-12 h-72 w-72 rounded-full bg-[#ff8b3d]/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-12 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <section className="pt-4 text-white">
          <div className="inline-flex items-end gap-1 rounded-[28px] bg-white/8 px-5 py-3 shadow-xl backdrop-blur">
            <span className="text-4xl font-black tracking-tight text-[#ff7f2a]">C</span>
            <span className="text-4xl font-black tracking-tight text-white">WK</span>
            <span className="mb-1 ml-2 text-xs font-medium uppercase tracking-[0.42em] text-white/75">coworking</span>
          </div>

          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.32em] text-white/70">Ficha cadastral publica</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
            Cadastro comercial da sua empresa na rede CWK
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/80 sm:text-lg">
            Preencha a ficha com os dados da empresa, representantes e contatos principais. A unidade escolhida define
            automaticamente o funil em que esse lead sera criado no CRM da CWK.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              "Unidade escolhida vira o funil correto no CRM",
              "Plano e contatos ficam registrados com clareza",
              "Informacoes detalhadas seguem para um diagnostico CWK no lead",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-sm leading-6 text-white/85 backdrop-blur">
                {item}
              </div>
            ))}
          </div>
        </section>

        <Card className="border-0 bg-white shadow-[0_24px_80px_rgba(28,18,45,0.32)]">
          <CardHeader className="space-y-2 border-b border-slate-100">
            <CardTitle className="text-2xl text-slate-900">Preencher ficha cadastral</CardTitle>
            <CardDescription>
              {step === 1 && "Etapa 1 de 4: unidade, plano e dados principais da empresa."}
              {step === 2 && "Etapa 2 de 4: endereco e dados cadastrais da empresa."}
              {step === 3 && "Etapa 3 de 4: representantes legais da empresa."}
              {step === 4 && "Etapa 4 de 4: contatos financeiro, comercial e recados."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {submitted ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <h2 className="mt-4 text-lg font-semibold text-slate-900">Ficha enviada com sucesso</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  O lead foi criado e sera enviado para a unidade selecionada no funil da CWK.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-5"
                  onClick={() => {
                    setSubmitted(false);
                    setStep(1);
                  }}
                >
                  Enviar outra ficha
                </Button>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={submit}>
                <div className="space-y-3 rounded-2xl border border-[#4f2878]/10 bg-[#f7f4fb] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Etapa {step} de 4</p>
                      <p className="text-sm text-slate-600">
                        {step === 1 && "Unidade, plano e dados principais"}
                        {step === 2 && "Endereco e cadastro fiscal"}
                        {step === 3 && "Representantes legais"}
                        {step === 4 && "Contatos e observacoes"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[#4f2878]">{progressPercentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#4f2878_0%,#ff7f2a_100%)] transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>

                {step === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <FieldLabel required>Qual unidade da CWK deve receber este lead?</FieldLabel>
                      <RadioGroup
                        value={form.unit}
                        onValueChange={(value) => patchForm({ unit: value })}
                        className="grid gap-3 sm:grid-cols-3"
                      >
                        {CWK_UNIT_OPTIONS.map((unit) => {
                          const checked = form.unit === unit.value;
                          return (
                            <label
                              key={unit.value}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors",
                                checked && "border-[#4f2878] bg-[#f7f0ff] shadow-sm",
                              )}
                            >
                              <RadioGroupItem value={unit.value} className="mt-1" />
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{unit.label}</p>
                                <p className="text-xs text-slate-500">Lead entra direto neste funil.</p>
                              </div>
                            </label>
                          );
                        })}
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel required>Plano escolhido</FieldLabel>
                      <Select value={form.plan || undefined} onValueChange={(value) => patchForm({ plan: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o plano" />
                        </SelectTrigger>
                        <SelectContent>
                          {CWK_PLAN_OPTIONS.map((plan) => (
                            <SelectItem key={plan.value} value={plan.value}>
                              {plan.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel htmlFor="cwk-company-name" required>Razao social</FieldLabel>
                      <Input
                        id="cwk-company-name"
                        value={form.company_or_person}
                        onChange={(event) => patchForm({ company_or_person: event.target.value })}
                        placeholder="Digite a razao social da empresa"
                        autoComplete="organization"
                        required
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <FieldLabel htmlFor="cwk-trade-name" required>Nome fantasia</FieldLabel>
                        <Input
                          id="cwk-trade-name"
                          value={form.trade_name}
                          onChange={(event) => patchForm({ trade_name: event.target.value })}
                          placeholder="Digite o nome fantasia"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <FieldLabel htmlFor="cwk-cnpj" required>CNPJ</FieldLabel>
                        <Input
                          id="cwk-cnpj"
                          value={form.cnpj}
                          onChange={(event) => patchForm({ cnpj: formatCnpj(event.target.value) })}
                          placeholder="00.000.000/0000-00"
                          inputMode="numeric"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel htmlFor="cwk-main-activity" required>Atividade principal</FieldLabel>
                      <Textarea
                        id="cwk-main-activity"
                        rows={4}
                        value={form.main_activity}
                        onChange={(event) => patchForm({ main_activity: event.target.value })}
                        placeholder="Descreva a atividade principal da empresa"
                        required
                      />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <FieldLabel htmlFor="cwk-address" required>Endereco da empresa</FieldLabel>
                      <Input
                        id="cwk-address"
                        value={form.address}
                        onChange={(event) => patchForm({ address: event.target.value })}
                        placeholder="Rua, numero e complemento"
                        required
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <FieldLabel htmlFor="cwk-neighborhood" required>Bairro</FieldLabel>
                        <Input
                          id="cwk-neighborhood"
                          value={form.neighborhood}
                          onChange={(event) => patchForm({ neighborhood: event.target.value })}
                          placeholder="Digite o bairro"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <FieldLabel htmlFor="cwk-cep" required>CEP</FieldLabel>
                        <Input
                          id="cwk-cep"
                          value={form.cep}
                          onChange={(event) => patchForm({ cep: formatCep(event.target.value) })}
                          placeholder="00000-000"
                          inputMode="numeric"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                      <div className="space-y-2">
                        <FieldLabel htmlFor="cwk-city" required>Cidade</FieldLabel>
                        <Input
                          id="cwk-city"
                          value={form.city}
                          onChange={(event) => patchForm({ city: event.target.value })}
                          placeholder="Digite a cidade"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <FieldLabel required>UF</FieldLabel>
                        <Select value={form.uf || undefined} onValueChange={(value) => patchForm({ uf: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="UF" />
                          </SelectTrigger>
                          <SelectContent>
                            {UF_OPTIONS.map((uf) => (
                              <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <FieldLabel htmlFor="cwk-company-phone" required>Celular da empresa</FieldLabel>
                        <Input
                          id="cwk-company-phone"
                          value={form.company_phone}
                          onChange={(event) => patchForm({ company_phone: formatPhone(event.target.value) })}
                          placeholder="(31) 99999-9999"
                          inputMode="tel"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <FieldLabel htmlFor="cwk-company-email" required>E-mail da empresa</FieldLabel>
                        <Input
                          id="cwk-company-email"
                          type="email"
                          value={form.company_email}
                          onChange={(event) => patchForm({ company_email: event.target.value })}
                          placeholder="empresa@dominio.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <FieldLabel htmlFor="cwk-state-registration" optional>Inscricao estadual</FieldLabel>
                        <Input
                          id="cwk-state-registration"
                          value={form.state_registration}
                          onChange={(event) => patchForm({ state_registration: event.target.value })}
                          placeholder="Se houver"
                        />
                      </div>

                      <div className="space-y-2">
                        <FieldLabel htmlFor="cwk-municipal-registration" optional>Inscricao municipal</FieldLabel>
                        <Input
                          id="cwk-municipal-registration"
                          value={form.municipal_registration}
                          onChange={(event) => patchForm({ municipal_registration: event.target.value })}
                          placeholder="Se houver"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <FieldLabel required>Retem ISSQN?</FieldLabel>
                        <RadioGroup
                          value={form.retains_issqn}
                          onValueChange={(value) => patchForm({ retains_issqn: value })}
                          className="grid gap-3 sm:grid-cols-2"
                        >
                          {yesNoOptions.map((option) => (
                            <label key={option.value} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                              <RadioGroupItem value={option.value} />
                              <span className="text-sm font-medium text-slate-800">{option.label}</span>
                            </label>
                          ))}
                        </RadioGroup>
                      </div>

                      <div className="space-y-2">
                        <FieldLabel required>Interesse em abertura/alteracao contratual do endereco?</FieldLabel>
                        <RadioGroup
                          value={form.contract_change_interest}
                          onValueChange={(value) => patchForm({ contract_change_interest: value })}
                          className="grid gap-3 sm:grid-cols-2"
                        >
                          {yesNoOptions.map((option) => (
                            <label key={option.value} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                              <RadioGroupItem value={option.value} />
                              <span className="text-sm font-medium text-slate-800">{option.label}</span>
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <RepresentativeSection
                      title="Representante legal 1"
                      description="Principal representante da empresa. Este bloco e obrigatorio."
                      representative={form.representative_one}
                      onPatch={(patch) => patchRepresentative("representative_one", patch)}
                      required
                    />

                    <RepresentativeSection
                      title="Representante legal 2"
                      description="Use se houver mais um socio ou representante legal."
                      representative={form.representative_two}
                      onPatch={(patch) => patchRepresentative("representative_two", patch)}
                    />
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-5">
                    <ContactSection
                      title="Contato comercial"
                      description="Este contato sera usado como principal no lead da CWK."
                      contact={form.commercial_contact}
                      onPatch={(patch) => patchContact("commercial_contact", patch)}
                      required
                    />

                    <ContactSection
                      title="Contato financeiro"
                      description="Opcional, mas recomendado para o cadastro ficar completo."
                      contact={form.financial_contact}
                      onPatch={(patch) => patchContact("financial_contact", patch)}
                    />

                    <Card className="border-slate-200">
                      <CardContent className="space-y-4 p-5">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">Atendimento / envio de recados</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Preencha apenas se houver atendimento com telefonia personalizada.
                          </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <FieldLabel htmlFor="cwk-message-contact-name" optional>Nome para atendimento</FieldLabel>
                            <Input
                              id="cwk-message-contact-name"
                              value={form.message_contact_name}
                              onChange={(event) => patchForm({ message_contact_name: event.target.value })}
                              placeholder="Nome do responsavel"
                            />
                          </div>

                          <div className="space-y-2">
                            <FieldLabel htmlFor="cwk-message-contact-phone" optional>Numero de celular</FieldLabel>
                            <Input
                              id="cwk-message-contact-phone"
                              value={form.message_contact_phone}
                              onChange={(event) => patchForm({ message_contact_phone: formatPhone(event.target.value) })}
                              placeholder="(31) 99999-9999"
                              inputMode="tel"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <FieldLabel htmlFor="cwk-message-contact-email" optional>Endereco de e-mail</FieldLabel>
                          <Input
                            id="cwk-message-contact-email"
                            type="email"
                            value={form.message_contact_email}
                            onChange={(event) => patchForm({ message_contact_email: event.target.value })}
                            placeholder="atendimento@empresa.com"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      <FieldLabel htmlFor="cwk-notes" optional>Observacoes adicionais</FieldLabel>
                      <Textarea
                        id="cwk-notes"
                        rows={4}
                        value={form.notes}
                        onChange={(event) => patchForm({ notes: event.target.value })}
                        placeholder="Se quiser, registre aqui alguma observacao complementar da ficha."
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  {step > 1 && (
                    <Button type="button" variant="outline" className="w-full sm:flex-1" onClick={goToPreviousStep}>
                      Voltar
                    </Button>
                  )}
                  {step < 4 ? (
                    <Button type="button" className="w-full bg-[#4f2878] font-semibold text-white hover:bg-[#442169] sm:flex-1" onClick={goToNextStep}>
                      Continuar
                    </Button>
                  ) : (
                    <Button type="submit" className="w-full bg-[#ff7f2a] font-semibold text-white hover:bg-[#ef7422] sm:flex-1" disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Enviar ficha cadastral
                    </Button>
                  )}
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
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const RepresentativeSection = ({
  title,
  description,
  representative,
  onPatch,
  required = false,
}: {
  title: string;
  description: string;
  representative: LegalRepresentativeForm;
  onPatch: (patch: Partial<LegalRepresentativeForm>) => void;
  required?: boolean;
}) => (
  <Card className="border-slate-200">
    <CardContent className="space-y-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <FieldLabel required={required}>Nome completo</FieldLabel>
          <Input
            value={representative.name}
            onChange={(event) => onPatch({ name: event.target.value })}
            placeholder="Nome completo"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel required={required}>RG</FieldLabel>
          <Input
            value={representative.rg}
            onChange={(event) => onPatch({ rg: event.target.value })}
            placeholder="Documento de identidade"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel required={required}>CPF</FieldLabel>
          <Input
            value={representative.cpf}
            onChange={(event) => onPatch({ cpf: formatCpf(event.target.value) })}
            placeholder="000.000.000-00"
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <FieldLabel optional>Endereco</FieldLabel>
          <Input
            value={representative.address}
            onChange={(event) => onPatch({ address: event.target.value })}
            placeholder="Rua, numero e complemento"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel optional>Bairro</FieldLabel>
          <Input
            value={representative.neighborhood}
            onChange={(event) => onPatch({ neighborhood: event.target.value })}
            placeholder="Bairro"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel optional>CEP</FieldLabel>
          <Input
            value={representative.cep}
            onChange={(event) => onPatch({ cep: formatCep(event.target.value) })}
            placeholder="00000-000"
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <div className="space-y-2">
          <FieldLabel optional>Cidade</FieldLabel>
          <Input
            value={representative.city}
            onChange={(event) => onPatch({ city: event.target.value })}
            placeholder="Cidade"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel optional>UF</FieldLabel>
          <Select value={representative.uf || undefined} onValueChange={(value) => onPatch({ uf: value })}>
            <SelectTrigger>
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {UF_OPTIONS.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <FieldLabel optional>Data de nascimento</FieldLabel>
          <Input
            type="date"
            value={representative.birth_date}
            onChange={(event) => onPatch({ birth_date: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel required={required}>Telefone</FieldLabel>
          <Input
            value={representative.phone}
            onChange={(event) => onPatch({ phone: formatPhone(event.target.value) })}
            placeholder="(31) 99999-9999"
            inputMode="tel"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel required={required}>E-mail</FieldLabel>
          <Input
            type="email"
            value={representative.email}
            onChange={(event) => onPatch({ email: event.target.value })}
            placeholder="nome@empresa.com"
          />
        </div>
      </div>
    </CardContent>
  </Card>
);

const ContactSection = ({
  title,
  description,
  contact,
  onPatch,
  required = false,
}: {
  title: string;
  description: string;
  contact: SimpleContactForm;
  onPatch: (patch: Partial<SimpleContactForm>) => void;
  required?: boolean;
}) => (
  <Card className="border-slate-200">
    <CardContent className="space-y-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>

      <div className="space-y-2">
        <FieldLabel required={required}>Nome completo</FieldLabel>
        <Input
          value={contact.name}
          onChange={(event) => onPatch({ name: event.target.value })}
          placeholder="Nome do contato"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel required={required}>Telefones</FieldLabel>
          <Input
            value={contact.phones}
            onChange={(event) => onPatch({ phones: event.target.value })}
            placeholder="Ex.: (31) 99999-9999 / (31) 3333-3333"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel required={required}>E-mails</FieldLabel>
          <Input
            value={contact.emails}
            onChange={(event) => onPatch({ emails: event.target.value })}
            placeholder="Ex.: nome@empresa.com; financeiro@empresa.com"
          />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default PublicCwkForm;
