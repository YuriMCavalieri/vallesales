import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const databaseUrl = Deno.env.get("SUPABASE_DB_URL");

if (!databaseUrl) {
  throw new Error("Configuracao do backend incompleta.");
}

const sql = postgres(databaseUrl, {
  max: 4,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});

type IntakePayload = {
  company_or_person?: unknown;
  contact_name?: unknown;
  service_types?: unknown;
  phone?: unknown;
  email?: unknown;
  employee_count?: unknown;
  source?: unknown;
  notes?: unknown;
  hp_field?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_term?: unknown;
  utm_content?: unknown;
  landing_path?: unknown;
  referrer?: unknown;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (message: string, status = 400) => json({ error: message }, status);

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizePhone = (value: unknown) => {
  const raw = normalizeOptionalString(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const countPhoneDigits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "").length;

const normalizeServiceTypes = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
};

const buildNotes = (payload: RequiredPick<IntakePayload, "employee_count" | "notes" | "utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content" | "landing_path" | "referrer">) => {
  const blocks: string[] = [];

  blocks.push([
    "Captacao publica",
    `Quantidade de funcionarios: ${payload.employee_count ?? "-"}`,
  ].join("\n"));

  if (payload.notes) {
    blocks.push([
      "Mensagem / observacoes",
      payload.notes,
    ].join("\n"));
  }

  const trackingLines = [
    payload.landing_path ? `Pagina: ${payload.landing_path}` : null,
    payload.referrer ? `Referrer: ${payload.referrer}` : null,
    payload.utm_source ? `utm_source: ${payload.utm_source}` : null,
    payload.utm_medium ? `utm_medium: ${payload.utm_medium}` : null,
    payload.utm_campaign ? `utm_campaign: ${payload.utm_campaign}` : null,
    payload.utm_term ? `utm_term: ${payload.utm_term}` : null,
    payload.utm_content ? `utm_content: ${payload.utm_content}` : null,
  ].filter(Boolean) as string[];

  if (trackingLines.length > 0) {
    blocks.push(["Tracking", ...trackingLines].join("\n"));
  }

  return blocks.length > 0 ? blocks.join("\n\n") : null;
};

type RequiredPick<T, K extends keyof T> = {
  [P in K]: string | null;
};

const getDefaultFunnelAndStage = async () => {
  const [funnel] = await sql`
    select id, name
    from public.funnels
    order by is_default desc, created_at asc
    limit 1
  `;

  if (!funnel) {
    throw new Error("Nenhum funil disponivel para receber captacoes.");
  }

  const [stage] = await sql`
    select id, name
    from public.pipeline_stages
    where funnel_id = ${funnel.id}
      and is_won = false
      and is_lost = false
    order by position asc, created_at asc
    limit 1
  `;

  if (!stage) {
    throw new Error("Nenhuma etapa inicial disponivel no funil principal.");
  }

  return {
    funnelId: funnel.id as string,
    stageId: stage.id as string,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Metodo nao permitido.", 405);

  try {
    const body = (await req.json().catch(() => ({}))) as IntakePayload;

    const company_or_person = normalizeOptionalString(body.company_or_person);
    const contact_name = normalizeOptionalString(body.contact_name);
    const serviceTypes = normalizeServiceTypes(body.service_types);
    const phone = normalizePhone(body.phone);
    const email = normalizeOptionalString(body.email);
    const employeeCount = normalizeOptionalString(body.employee_count);
    const source = normalizeOptionalString(body.source) ?? "Formulario site";
    const serviceDetails = normalizeOptionalString(body.notes);
    const hpField = normalizeOptionalString(body.hp_field);

    if (hpField) {
      return json({ ok: true, ignored: true });
    }

    if (!company_or_person) {
      return fail("Informe a empresa ou pessoa.");
    }

    if (!contact_name) {
      return fail("Informe o nome do contato.");
    }

    if (countPhoneDigits(phone) < 10) {
      return fail("Informe um telefone valido.");
    }

    if (serviceTypes.length === 0) {
      return fail("Selecione ao menos um servico.");
    }

    if (!email) {
      return fail("Informe um e-mail valido.");
    }

    if (!employeeCount) {
      return fail("Informe quantos funcionarios voce possui.");
    }

    const notes = buildNotes({
      employee_count: employeeCount,
      notes: serviceDetails,
      utm_source: normalizeOptionalString(body.utm_source),
      utm_medium: normalizeOptionalString(body.utm_medium),
      utm_campaign: normalizeOptionalString(body.utm_campaign),
      utm_term: normalizeOptionalString(body.utm_term),
      utm_content: normalizeOptionalString(body.utm_content),
      landing_path: normalizeOptionalString(body.landing_path),
      referrer: normalizeOptionalString(body.referrer),
    });

    const { funnelId, stageId } = await getDefaultFunnelAndStage();

    const duplicateRows = email
      ? await sql`
          select id
          from public.leads
          where funnel_id = ${funnelId}
            and created_at >= now() - interval '10 minutes'
            and (
              phone = ${phone}
              or email = ${email}
            )
          limit 1
        `
      : await sql`
          select id
          from public.leads
          where funnel_id = ${funnelId}
            and created_at >= now() - interval '10 minutes'
            and phone = ${phone}
          limit 1
        `;

    const [recentDuplicate] = duplicateRows;

    if (recentDuplicate) {
      return json({ ok: true, duplicate: true });
    }

    const [createdLead] = await sql`
      insert into public.leads (
        funnel_id,
        company_or_person,
        contact_name,
        phone,
        email,
        source,
        estimated_value,
        temperature,
        stage_id,
        has_been_contacted,
        notes,
        service_types,
        service_details
      ) values (
        ${funnelId},
        ${company_or_person},
        ${contact_name},
        ${phone},
        ${email},
        ${source},
        0,
        'morno',
        ${stageId},
        false,
        ${notes},
        ${serviceTypes},
        ${serviceDetails}
      )
      returning id, company_or_person
    `;

    if (createdLead?.id) {
      await sql`
        insert into public.lead_activities (lead_id, type, description)
        values (
          ${createdLead.id},
          'lead_created',
          ${`Lead criado via captacao publica: ${createdLead.company_or_person}`}
        )
      `;
    }

    return json({ ok: true, lead_id: createdLead?.id ?? null }, 201);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Erro inesperado ao processar o formulario.";
    return fail(message, 500);
  }
});
