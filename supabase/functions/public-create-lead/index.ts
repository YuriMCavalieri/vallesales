import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_FUNNEL_NAME = "NeoContador";

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

type CreateLeadPayload = {
  company_or_person?: unknown;
  contact_name?: unknown;
  phone?: unknown;
  email?: unknown;
  source?: unknown;
  segment?: unknown;
  city?: unknown;
  uf?: unknown;
  notes?: unknown;
  funnel_name?: unknown;
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

const normalizeTextKey = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const resolveFunnelAndStage = async (funnelName: string) => {
  const funnels = await sql`
    select id, name
    from public.funnels
    order by is_default desc, created_at asc
  `;

  const funnel = funnels.find(
    (item) => normalizeTextKey(item.name as string) === normalizeTextKey(funnelName),
  ) as { id: string; name: string } | undefined;

  if (!funnel) {
    throw new Error(`Funil "${funnelName}" nao encontrado.`);
  }

  const [novoLeadStage] = await sql`
    select id
    from public.pipeline_stages
    where funnel_id = ${funnel.id}
      and key = 'novo_lead'
      and is_won = false
      and is_lost = false
    limit 1
  `;

  if (novoLeadStage) {
    return { funnelId: funnel.id as string, stageId: novoLeadStage.id as string };
  }

  const [firstStage] = await sql`
    select id
    from public.pipeline_stages
    where funnel_id = ${funnel.id}
      and is_won = false
      and is_lost = false
    order by position asc, created_at asc
    limit 1
  `;

  if (!firstStage) {
    throw new Error(`Nenhuma etapa inicial disponivel no funil "${funnelName}".`);
  }

  return { funnelId: funnel.id as string, stageId: firstStage.id as string };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Metodo nao permitido.", 405);

  try {
    const body = (await req.json().catch(() => ({}))) as CreateLeadPayload;

    const companyOrPerson = normalizeOptionalString(body.company_or_person) ?? "Novo lead";
    const contactName = normalizeOptionalString(body.contact_name);
    const phone = normalizeOptionalString(body.phone);
    const email = normalizeOptionalString(body.email);
    const source = normalizeOptionalString(body.source) ?? "API";
    const segment = normalizeOptionalString(body.segment);
    const city = normalizeOptionalString(body.city);
    const uf = normalizeOptionalString(body.uf);
    const notes = normalizeOptionalString(body.notes);
    const funnelName = normalizeOptionalString(body.funnel_name) ?? DEFAULT_FUNNEL_NAME;

    const { funnelId, stageId } = await resolveFunnelAndStage(funnelName);

    const [createdLead] = await sql`
      insert into public.leads (
        funnel_id,
        company_or_person,
        contact_name,
        phone,
        email,
        source,
        segment,
        city,
        uf,
        notes,
        estimated_value,
        temperature,
        stage_id,
        has_been_contacted
      ) values (
        ${funnelId},
        ${companyOrPerson},
        ${contactName},
        ${phone},
        ${email},
        ${source},
        ${segment},
        ${city},
        ${uf},
        ${notes},
        0,
        'morno',
        ${stageId},
        false
      )
      returning id, company_or_person
    `;

    if (createdLead?.id) {
      await sql`
        insert into public.lead_activities (lead_id, type, description)
        values (
          ${createdLead.id},
          'lead_created',
          ${`Lead criado via API: ${createdLead.company_or_person}`}
        )
      `;
    }

    return json({ ok: true, lead_id: createdLead?.id ?? null }, 201);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Erro inesperado ao criar o lead.";
    return fail(message, 500);
  }
});
