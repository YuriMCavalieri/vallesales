# Valle Sales CRM

Aplicacao Vite + React + Supabase para gestao comercial.

## Ambiente

Copie `.env.example` para `.env` e preencha com os dados do projeto Supabase que sera usado:

```env
VITE_SUPABASE_PROJECT_ID="seu-project-ref"
VITE_SUPABASE_URL="https://seu-project-ref.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-anon-publishable-key"
```

As tres variaveis precisam apontar para o mesmo project ref. A chave publishable/anon deve ser copiada do painel do Supabase do novo projeto.

## Comandos

```bash
npm install
npm run dev
npm run check
npm run build
```

`npm run check` executa lint, typecheck, testes e build de producao.

## Migracao Supabase

1. Crie o novo projeto no Supabase.
2. Atualize `.env` e `supabase/config.toml` com o novo project ref.
3. Rode as migrations em `supabase/migrations`.
4. Importe os dados exportados do projeto antigo.
5. Confirme que o bucket privado `lead-attachments` existe. Ele ja e criado pela primeira migration.
6. Configure os secrets da edge function `leads-api`:

```bash
SUPABASE_DB_URL=postgresql://...
SUPABASE_URL=https://seu-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

7. Deploye a edge function `leads-api`.
8. No painel do Supabase, configure Auth providers e redirect URLs do dominio publicado e dos previews.

O login Google usa o OAuth nativo do Supabase. Configure o provider Google no painel do Supabase antes de publicar.
