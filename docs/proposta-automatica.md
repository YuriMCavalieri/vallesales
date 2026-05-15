# Proposta Automatica

## Objetivo

Gerar automaticamente uma proposta comercial em PDF quando o lead for movido para a etapa `Proposta enviada`, usando os dados ja existentes no CRM e alguns novos campos comerciais.

## Recomendacao

Para este caso, a melhor abordagem e gerar a proposta fora do Canva, usando o Canva apenas como referencia visual.

Motivos:

- o sumario muda conforme a quantidade de paginas
- alguns slides entram ou saem conforme os servicos do lead
- a analise do cliente muda bastante
- a proposta financeira exige campos comerciais editaveis

Esse comportamento e mais proximo de um gerador de documento modular do que de um simples preenchimento de template.

## Gatilho

O gatilho deve acontecer quando o lead mudar para a etapa `proposta_enviada`.

Pontos atuais do projeto:

- a etapa ja existe no banco
- a mudanca de etapa passa pelo backend central
- o backend ja detecta `stage_id` alterado

Referencias:

- `supabase/migrations/20260427134952_f44a993b-1c67-4692-ae82-054280cec6aa.sql`
- `supabase/functions/leads-api/index.ts`

## Campos Ja Disponiveis

O CRM ja possui dados suficientes para preencher boa parte da proposta:

- nome da empresa
- contato principal
- telefone e email
- CNPJ
- cidade e UF
- segmento
- regime tributario
- maturidade da empresa
- valor estimado
- servicos marcados no lead
- detalhamento dos servicos
- diagnostico financeiro
- dores operacionais e contabeis

Campos hoje mapeados no backend:

- `company_or_person`
- `contact_name`
- `phone`
- `email`
- `cnpj`
- `city`
- `uf`
- `segment`
- `segment_other`
- `company_maturity`
- `estimated_value`
- `tax_regime`
- `service_types`
- `service_details`
- `monthly_revenue_managerial`
- `monthly_revenue_fiscal`
- `monthly_invoice_count`
- `employee_count_clt`
- `employee_count_pj`
- `payroll_gross_value`
- `bank_account_count`
- `bank_accounts_split`
- `financial_system`
- `accounting_pain_points`

## Novos Campos Recomendados

Para a proposta automatica ficar completa, vale adicionar estes campos no lead:

- `proposal_status`
- `proposal_generated_at`
- `proposal_pdf_path`
- `proposal_version`
- `proposal_client_logo_path`
- `proposal_client_summary`
- `proposal_client_analysis`
- `proposal_scope_overrides`
- `proposal_setup_fee`
- `proposal_monthly_fee`
- `proposal_discount_type`
- `proposal_discount_value`
- `proposal_payment_terms`
- `proposal_valid_until`
- `proposal_notes`
- `proposal_selected_modules`

### Uso de cada grupo

- `proposal_client_logo_path`: logo do cliente usada nos slides de analise
- `proposal_client_summary`: resumo curto da empresa
- `proposal_client_analysis`: texto principal dos slides 8 e 9
- `proposal_scope_overrides`: permite ajustar o escopo manualmente antes de gerar
- `proposal_*fee*` e `proposal_*payment*`: alimentam os slides financeiros
- `proposal_selected_modules`: permite remover ou forcar modulos alem do que veio de `service_types`

## Estrutura Recomendada da Proposta

### Blocos fixos

Esses blocos podem permanecer sempre:

- capa
- apresentacao institucional
- fechamento

### Blocos dinamicos

#### Slide 2

Sumario automatico com base nos modulos realmente incluidos na proposta final.

#### Slides 8 e 9

Analise do cliente com:

- nome da empresa
- logo
- resumo da empresa
- analise comercial personalizada

#### Slides 11 a 23

Modulos opcionais por servico.

Cada modulo deve ser tratado como uma secao independente:

- Gestao Contabil
- Gestao Trabalhista
- Gestao Tributaria
- Legalizacao de Empresas
- BPO Financeiro
- Coworking / Sede Virtual

Se o servico nao estiver selecionado, a secao nao entra no PDF.

#### Slides 25 e 26

Proposta financeira com:

- taxa de implantacao
- mensalidade
- desconto
- forma de pagamento
- validade
- observacoes comerciais

## Regra de Entrada dos Modulos

Sugestao inicial:

- `Gestao Contabil` -> inclui secao contabil
- `Gestao Trabalhista` -> inclui secao trabalhista
- `Gestao Tributaria` -> inclui secao tributaria
- `Legalizacao de Empresas` -> inclui secao de abertura/legalizacao
- `BPO Financeiro` -> inclui secao financeira
- servicos de coworking -> inclui secao de coworking correspondente

Tambem vale permitir ajuste manual no CRM antes de gerar, porque nem sempre o que foi marcado no diagnostico sera exatamente o que entrara na proposta final.

## Fluxo Sugerido

1. Usuario move o lead para `Proposta enviada`.
2. Backend identifica a mudanca de etapa.
3. Sistema valida se os campos obrigatorios da proposta estao preenchidos.
4. Sistema monta um payload consolidado da proposta.
5. Gerador seleciona os modulos que entram.
6. Gerador calcula o sumario final.
7. Sistema gera o PDF.
8. PDF e salvo no storage.
9. PDF e vinculado ao lead como anexo.
10. Sistema registra atividade no historico do lead.

## Validacoes Antes de Gerar

Campos minimos recomendados:

- empresa
- pelo menos um servico selecionado
- analise do cliente
- valor de proposta
- condicoes de pagamento

Se algum campo obrigatorio estiver faltando, o sistema deve impedir a geracao e mostrar o que falta preencher.

## Arquitetura Recomendada

### Banco

Adicionar colunas no `public.leads` para os dados comerciais da proposta.

### Backend

Criar uma edge function dedicada, por exemplo:

- `supabase/functions/generate-proposal/index.ts`

Responsabilidades:

- buscar dados do lead
- validar campos
- montar payload
- decidir modulos
- gerar HTML
- converter para PDF
- salvar no storage
- registrar anexo e atividade

### Frontend

Adicionar uma area de "Proposta" no detalhe do lead ou no modal de edicao com:

- analise do cliente
- configuracao dos modulos
- campos financeiros
- botao "Gerar proposta"
- botao "Regenerar proposta"
- preview dos dados antes da geracao

## Tecnologia Sugerida

### Melhor opcao

HTML + CSS + geracao de PDF no backend.

Beneficios:

- controle total do layout
- facilidade para incluir ou remover secoes
- sumario dinamico
- menos dependencia de permissao/licenciamento do Canva
- manutencao mais previsivel

### Alternativa

Canva como template preenchivel.

So vale a pena se:

- o arquivo-fonte estiver muito bem estruturado
- os slides forem estaveis
- o time quiser manter a edicao final dentro do Canva

Mesmo assim, a logica de incluir ou excluir paginas ainda torna esse caminho menos robusto.

## MVP Recomendado

### Fase 1

- criar campos comerciais da proposta
- criar tela de edicao da proposta no lead
- criar gerador com modulos dinamicos
- gerar PDF e anexar no lead

### Fase 2

- versionamento da proposta
- historico de regeneracoes
- aprovacao interna antes do envio
- envio automatico por email ou WhatsApp

## Mapeamento Inicial CRM -> Proposta

- `company_or_person` -> nome da empresa na capa e analise
- `cnpj` -> dados cadastrais
- `segment` + `segment_other` -> perfil da empresa
- `company_maturity` -> contexto do cliente
- `service_types` -> modulos que entram
- `service_details` -> descricao da necessidade
- `accounting_pain_points` -> dor / analise
- `monthly_revenue_managerial` e correlatos -> diagnostico
- `proposal_client_analysis` -> texto final dos slides 8 e 9
- `proposal_setup_fee` e `proposal_monthly_fee` -> proposta financeira

## Proximo Passo de Implementacao

1. adicionar os campos novos no banco
2. expor esses campos no formulario do lead
3. criar a secao "Proposta" no frontend
4. criar a edge function de geracao
5. criar o template HTML/PDF modular
6. anexar o PDF gerado no lead
