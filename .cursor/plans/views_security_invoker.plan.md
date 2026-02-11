---
name: Views security_invoker
overview: Corrigir alerta de segurança do Supabase nas views vendas_hoje, produtos_estoque_baixo e resumo_caixa_hoje definindo security_invoker; atualizar scripts, documentar e validar com testes e homologação.
todos:
  - id: T1
    content: Migration ALTER VIEW + atualizar views-uteis.sql e setup-database.sql
    agent: agente-backend
  - id: T2
    content: Documentar decisão e menção em scripts/setup
    agent: agente-documentacao
  - id: T3
    content: Teste de leitura das views com usuário autenticado
    agent: agente-testes
  - id: T4
    content: Revisão de segurança (views e RLS)
    agent: agente-seguranca
isProject: false
---

# Plano: Views security_invoker (segurança Supabase)

## Agentes e subagentes — quem faz o quê

Cada agente abaixo executa **apenas** a tarefa indicada. Ordem de execução: T1 → T2, T3 e T4 (T2/T3/T4 podem ser em paralelo após T1).

| ID | Agente (skill) | Tarefa específica |
|----|----------------|--------------------|
| **T1** | **Backend** — `.cursor/skills/agente-backend/` | Criar migration com `ALTER VIEW ... SET (security_invoker = true)` para as três views; atualizar `scripts/views-uteis/views-uteis.sql` e `scripts/setup-database/setup-database.sql` para criar as views já com `WITH (security_invoker = true)`. |
| **T2** | **Docs** — `.cursor/skills/agente-documentacao/` | Criar `docs/decisions/views-security-invoker.md`; atualizar `scripts/README.md` e/ou `docs/setup/` / `docs/new-setup-att/relacionamentos-tabelas.md` com menção à mudança. |
| **T3** | **Testes** — `.cursor/skills/agente-testes/` | Adicionar ou estender teste que valide leitura de pelo menos uma das views (`vendas_hoje`, `produtos_estoque_baixo`, `resumo_caixa_hoje`) com usuário autenticado; garantir `npm run test` verde. |
| **T4** | **Segurança** — `.cursor/skills/agente-seguranca/` | Revisar a alteração (não implementar): RLS, views, conformidade; devolver resumo, riscos e recomendações no formato do skill. |

**Agentes não usados neste plano:** Frontend, Offline, PDV, Refactor, Tasks, CI/CD (nenhuma tarefa deles neste escopo).

---

## Fase 1 — Banco/Infra (Backend)

### Task T1 — Views security_invoker (migration + scripts)

**Agente:** Backend (`agente-backend`)

**Arquivos:** `scripts/migrations/2026-02-11-views-security-invoker.sql`, `scripts/views-uteis/views-uteis.sql`, `scripts/setup-database/setup-database.sql`

**Briefing para copiar no chat do Backend:**

- **Objetivo:** Corrigir alerta de segurança do Supabase: views `vendas_hoje`, `produtos_estoque_baixo` e `resumo_caixa_hoje` devem usar permissões do usuário que consulta (security_invoker).
- **Tarefas:**
  1. Criar migration em `scripts/migrations/` (ex.: `2026-02-11-views-security-invoker.sql`) com os três `ALTER VIEW public.<nome> SET (security_invoker = true);`
  2. Em `scripts/views-uteis/views-uteis.sql`: em cada um dos três `CREATE OR REPLACE VIEW ... AS`, adicionar `WITH (security_invoker = true)` antes do `AS`
  3. Em `scripts/setup-database/setup-database.sql` (seção VIEWS ÚTEIS): mesma alteração nas três views
- **Contratos:** Apenas SQL; sem alteração em API, repositories ou tipos. Reversão: `ALTER VIEW ... SET (security_invoker = false)` se necessário.
- **Critérios de aceitação:** Migration aplicável sem erro; scripts passam a criar as views com security_invoker; nenhuma alteração em `src/`.

**Linha para TASKS.md:** `- [ ] T1: Views security_invoker (migration + scripts) — @agente-backend`

---

## Fase 2 — Documentação (Docs)

### Task T2 — Documentar views security_invoker

**Agente:** Docs (`agente-documentacao`)

**Arquivos:** `docs/decisions/views-security-invoker.md`, `scripts/README.md`, `docs/setup/SETUP_DATABASE.md` ou `docs/new-setup-att/relacionamentos-tabelas.md`

**Briefing para copiar no chat do Docs:**

- **O que documentar:** Decisão de segurança sobre as views de relatório e onde a mudança aparece nos scripts.
- **Onde:**
  1. Criar `docs/decisions/views-security-invoker.md` (motivo, solução, PostgreSQL 15+, referência à migration e scripts)
  2. Atualizar `scripts/README.md` (seção views) e/ou docs de setup: indicar que as três views são criadas com `security_invoker = true` para respeitar RLS
- **Público:** desenvolvedores e quem aplica migrations/setup.
- **Restrições:** Não implementar código nem alterar migrations; apenas documentação.

**Linha para TASKS.md:** `- [ ] T2: Documentar views security_invoker — @agente-documentacao`

---

## Fase 3 — Testes (Testes)

### Task T3 — Teste de leitura das views (security_invoker)

**Agente:** Testes (`agente-testes`)

**Arquivos:** `tests/` (integration ou unit conforme estrutura do projeto)

**Briefing para copiar no chat do Testes:**

- **Escopo:** Garantir que, após a migration, a leitura das views continua funcionando para usuário autenticado (RLS aplicado; nada quebrado).
- **Cenários obrigatórios:** Com mock do Supabase (e usuário autenticado se existir): select em pelo menos uma das views (`vendas_hoje`, `produtos_estoque_baixo` ou `resumo_caixa_hoje`) e validar resposta sem erro. Se já houver teste de integração de vendas/caixa/estoque, estender para incluir leitura de uma dessas views com auth.
- **Mocks:** Supabase client (e auth conforme reference do agente-testes).
- **Critérios:** `npm run test` verde; nenhuma alteração em código de produção além do necessário para testabilidade.

**Linha para TASKS.md:** `- [ ] T3: Teste leitura views security_invoker — @agente-testes`

---

## Fase 4 — Revisão (Segurança)

### Task T4 — Revisão de segurança (views security_invoker)

**Agente:** Segurança (`agente-seguranca`) — **apenas revisão**

**Arquivos:** Nenhum (revisão).

**Briefing para copiar no chat do Segurança:**

- **Objetivo:** Revisar a alteração nas views (security_invoker) e confirmar conformidade com RLS e boas práticas.
- **Contexto:** Views `vendas_hoje`, `produtos_estoque_baixo` e `resumo_caixa_hoje` alteradas para `security_invoker = true` via migration e scripts; tabelas base já têm RLS ativo.
- **Entregável:** Resumo da revisão, riscos, recomendações e conformidade no formato do skill agente-seguranca.

**Linha para TASKS.md:** `- [ ] T4: Revisão segurança views security_invoker — @agente-seguranca`

---

## Validação em homologação (manual)

Após T1–T4: executar a migration no Supabase (homologação); rodar `SELECT * FROM vendas_hoje`, `produtos_estoque_baixo`, `resumo_caixa_hoje` com usuário autenticado; conferir no Advisor do Supabase que o alerta de SECURITY DEFINER sumiu.

---

## Riscos e reversão

- **Risco:** Qualquer processo que dependa do dono da view pode mudar comportamento; no projeto atual o app não consulta essas views via Supabase (risco baixo).
- **Reversão:** `ALTER VIEW public.vendas_hoje SET (security_invoker = false);` (e idem para as outras duas views).
