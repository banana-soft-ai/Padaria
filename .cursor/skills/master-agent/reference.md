# Referência — Agente Master Rey dos Pães

> Atualizado em: 2026-02-09

## Fonte de verdade do projeto

- **Contexto completo (stack, convenções, decisões, módulos)**: usar a skill **project-context** (`.cursor/skills/project-context/`). É a PROJECT_CONTEXT compartilhada entre todos os agentes; atualize-a quando houver mudanças arquiteturais ou de status dos módulos.

## Arquitetura do Projeto

```
PRESENTATION → src/app/ (App Router), src/components/, src/hooks/
BUSINESS     → src/services/, src/repositories/, src/lib/
DATA         → Supabase (PostgreSQL), IndexedDB (offline), syncService
```

## Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS 3.4, Headless UI, Lucide React |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| Formulários | React Hook Form + Zod |
| Gráficos | Recharts |
| Código de barras | @zxing/browser, BarcodeDetector |
| Testes | Jest + Testing Library |
| Deploy | Railway / Docker / Vercel |

## Estrutura de Pastas

```
src/
├── app/                    # Páginas (App Router)
│   ├── api/                # Rotas API
│   ├── caixa/              # PDV e caderneta
│   ├── estoque/
│   ├── gestao/             # Dashboard, caixas, vendas, precos
│   ├── receitas/
│   ├── sistema/            # Usuários, pagamentos
│   └── vendas/
├── components/             # Componentes reutilizáveis
│   ├── caixa/, caderneta/, gestao/, vendas/
├── hooks/                  # Custom hooks (incl. offline)
├── lib/                    # Utilitários, Supabase, sync, preco
├── repositories/           # Acesso a dados
├── services/               # Lógica de negócio
└── types/                  # Tipos TypeScript
```

## Tabela de Delegação Completa

| Tipo de Tarefa | Agente | Skill / Rules |
|----------------|--------|------------------|
| UI, componentes, páginas, hooks, UX | Frontend | `.cursor/skills/agente-frontend/` (skill) |
| API routes, services, repositories, Supabase, RLS | Backend | `.cursor/skills/agente-backend/` (skill) |
| IndexedDB, syncService, Service Worker, PWA | Offline | `.cursor/skills/offline-sync/` (skill) |
| PDV, caixa, caderneta, impressão, balança | PDV | `.cursor/skills/agente-pdv/` (skill) |
| Jest, Testing Library, cobertura | Testes | `.cursor/skills/agente-testes/` (skill) |
| Refatoração, performance, limpeza, DRY | Refactor | `.cursor/skills/agente-refatoracao/` (skill) |
| Documentação, README, JSDoc, changelogs, guias operadores | Docs | `.cursor/skills/agente-documentacao/` (skill) |
| Atualizar tasks, mover entre seções, arquivar sprint, estado do projeto | Tasks | `.cursor/skills/agente-tasks/` (skill) |
| Pipeline, GitHub Actions, lint/typecheck/test/build, gates de merge | CI/CD | `.cursor/skills/ci-cd-qualidade/` (skill) |

## Fases do Plano de Execução

```
FASE 1 — Banco/Infra (migrations, RLS, types)
FASE 2 — Backend (repositories, services, API routes)
FASE 3 — Offline (IndexedDB schemas, sync handlers)
FASE 4 — Frontend (componentes, páginas, hooks)
FASE 5 — PDV (se envolve caixa/caderneta/impressão)
FASE 6 — Testes (unitários, integração)
FASE 7 — Docs (atualizar documentação)
FASE 8 — CI/CD (quando aplicável: workflow, gates)
```

## Definição de pronto por fase

- **Fase 1 (Banco):** migrations aplicáveis sem erro, RLS documentado, types em `src/types` atualizados.
- **Fase 2 (Backend):** repositories e services implementados, tipos exportados, `npm run build` sem erro.
- **Fase 3 (Offline):** schemas IndexedDB e handlers de sync alinhados aos dados; fluxo offline descrito.
- **Fase 4 (Frontend):** componentes/páginas/hooks implementados, loading/error/empty considerados, sem lógica de negócio em componente.
- **Fase 5 (PDV):** fluxo de caixa/caderneta/impressão funcionando conforme critérios; balança/leitor se aplicável.
- **Fase 6 (Testes):** cenários críticos cobertos; cobertura mínima respeitada.
- **Fase 7 (Docs):** README/JSDoc/guias atualizados onde combinado.
- **Fase 8 (CI/CD):** workflow verde; gates configurados conforme projeto.

## Definição de pronto por tipo de tarefa

| Tipo | DoD mínima |
|------|-------------|
| **Backend** | Endpoint/Service documentado em `docs/api/` ou JSDoc; tipos em `src/types/`; RLS descrita; migration reversível se houver. |
| **Frontend** | Loading/error/empty; tipos de `src/types/`; sem lógica de negócio em componente; acessibilidade básica. |
| **Testes** | Cenários obrigatórios do módulo cobertos; mocks limpos; `npm run test` verde. |
| **Offline** | Schema IndexedDB e conflitos alinhados a `docs/offline/` ou reference do skill; dual path testado. |
| **PDV** | Fluxo completo; impressão não bloqueia venda; performance &lt; 200 ms onde definido. |
| **Docs** | Documento no local correto em `docs/`; README atualizado se necessário; links válidos. |
| **Refactor** | Comportamento idêntico; lista de testes afetados; zero `any` adicionado. |
| **CI/CD** | Jobs com nomes alinhados aos branch protection checks; sem segredos expostos. |

## Contrato de entrega do subagente

Ao concluir uma tarefa delegada pelo Master, o subagente deve devolver (no chat ou no plano):

1. **Entregue:** lista de arquivos criados/alterados.
2. **Critérios atendidos:** checklist do briefing marcado (ou lista explícita).
3. **Pendências:** o que ficou de fora ou depende de outro agente (ex.: "RLS a ser criada pelo Backend").

Isso permite ao Master validar sem reler todo o código. O Master pode pedir esse formato ao solicitar a execução.

## Roteamento por intenção

| Intenção | Quem inicia | Ordem sugerida |
|----------|-------------|-----------------|
| Corrigir bug (cálculo, regra) | Backend | Backend → Testes (e Frontend se UI afetada) |
| Corrigir bug (só UI) | Frontend | Frontend → Testes |
| Otimizar performance | Refactor | Refactor → Testes |
| Adicionar campo (tabela + API + tela) | Master | Banco → Backend → Offline → Frontend → Testes → Docs |
| Adicionar endpoint só | Backend | Backend → Docs (API) |
| Só documentar | Docs | Docs |
| Atualizar estado do sprint | Tasks | Tasks |

## Procedimento para conflitos entre subagentes (desempate)

1. **Identificar:** descrever o conflito (ex.: contrato da API vs uso no frontend).
2. **Decidir:** prioridade = ordem das fases (dados → backend → frontend) e convenções do **project-context**. Fonte de verdade em dúvida: **backend**; frontend adapta. Em empate: última fase na ordem de execução vence; se ainda ambíguo, **project-context** é a fonte de verdade.
3. **Documentar:** registrar a decisão em "Riscos e Observações" do plano, em `docs/decisions/` (um arquivo por decisão, ex.: `YYYY-MM-DD-contrato-api-vendas.md`) ou em comentário no código/README.

## Templates de briefing por agente

Ao delegar, preencher o template do agente e entregar como bloco **copy-paste** para novo chat.

### Frontend (agente-frontend)
- **Objetivo:** [o que a UI deve fazer]
- **Arquivos a criar/alterar:** [paths]
- **Critérios de aceitação:** [lista]
- **Dados/hooks já existentes:** [useX, services a consumir]
- **Restrições:** não criar API; não alterar services/repositories.

### Backend (agente-backend)
- **Objetivo:** [o que a camada de dados/negócio deve fazer]
- **Tabelas/RLS afetados:** [nomes]
- **Endpoints ou services:** [rotas, nomes de funções]
- **Contratos:** [request/response ou assinaturas esperadas]
- **Offline:** sim/não; se sim, como expor para sync.

### Offline (offline-sync)
- **Objetivo:** [o que deve funcionar offline]
- **Entidades:** [tabelas/objetos a espelhar em IndexedDB]
- **Handlers de sync:** [upload/download, conflitos]
- **Arquivos:** [schemas, syncService, hooks use*Offline].

### PDV (agente-pdv)
- **Objetivo:** [fluxo de caixa/caderneta/impressão/balança]
- **Páginas/componentes:** [paths]
- **Critérios de aceitação:** [lista]
- **Contexto:** [regras de negócio relevantes].

### Testes (agente-testes)
- **Escopo:** [arquivo ou funcionalidade a testar]
- **Cenários obrigatórios:** [lista]
- **Mocks necessários:** [Supabase, hooks, etc.].

### Docs (agente-documentacao)
- **O que documentar:** [feature, API, fluxo]
- **Onde:** README, JSDoc, `docs/`, changelog
- **Público:** dev, operador, etc.

### Refactor (agente-refatoracao)
- **Objetivo:** [o que melhorar sem mudar comportamento]
- **Arquivos/área:** [paths ou módulo]
- **Critérios:** [DRY, performance, legibilidade].

### CI/CD (ci-cd-qualidade)
- **Objetivo:** [novo job, gate, ajuste de pipeline]
- **Arquivos:** `.github/workflows/`, config de lint/test.
- **Critérios:** [o que deve passar no merge].

### Tasks (agente-tasks)
- **Ação:** atualizar/mover/criar sprint em `docs/TASKS.md`
- **Itens:** [lista de tasks no formato do arquivo].

## Checklist de validação por fase

- **Fase 1 (Banco):** [ ] Migrations reversíveis? [ ] RLS documentado? [ ] Types em `src/types`?
- **Fase 2 (Backend):** [ ] Repositories testados? [ ] Services sem side-effects desnecessários? [ ] Offline considerado?
- **Fase 3 (Offline):** [ ] Schemas alinhados ao Supabase? [ ] Conflitos de sync tratados?
- **Fase 4 (Frontend):** [ ] Loading/error/empty states? [ ] Acessibilidade básica? [ ] Sem lógica de negócio em componente?
- **Fase 5 (PDV):** [ ] Fluxo completo coberto? [ ] Impressão/balança se aplicável?
- **Fase 6 (Testes):** [ ] Cenários críticos cobertos? [ ] Cobertura mínima?
- **Fase 7 (Docs):** [ ] Atualizado onde necessário?
- **Geral:** [ ] Types consistentes? [ ] RLS onde há dados? [ ] Convenções do project-context respeitadas?

## Procedimento para conflitos entre subagentes

Ver seção **Procedimento para conflitos entre subagentes (desempate)** acima (inclui regra de desempate e uso de `docs/decisions/`).

## Rollback em fases críticas

Para **Fase 1 (Banco)** e **Fase 2 (Backend)** com breaking changes ou migrations, incluir em "Riscos e Observações":
- **Reversão:** [ex.: "Migration down em `scripts/migrations/XXXX-nome.sql`" ou "Reverter commit X e rodar migration anterior"]. Não deixar reversão implícita.

## Convenções de Código

- TypeScript strict em tudo.
- Validação com Zod em formulários e API routes.
- **Componentes**: PascalCase (`CaixaResumo.tsx`).
- **Hooks**: camelCase com prefixo `use` (`useOfflineStorage.ts`).
- **Services/Repos**: camelCase (`vendaService.ts`, `produtoRepository.ts`).
- Types centralizados em `src/types/`.

## Convenções de Negócio

- **Valores monetários**: sempre em centavos (inteiro) internamente; formatar só na exibição.
- **Datas**: ISO 8601; timezone America/Sao_Paulo na exibição.
- **Roles**: `admin`, `gerente`, `funcionario`, `caixa`.
- Toda operação que toca dados deve funcionar offline.
- Toda tabela no Supabase deve ter RLS.

## Convenções de Git

- Commits em português: `tipo(escopo): descrição`.
- Tipos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
- Exemplo: `feat(caixa): adicionar pagamento PIX split`.

---

## Roteamento por Domínio (especialistas)

### Estoque (estoque.agent.md)

| Categoria | Termos |
|-----------|--------|
| Entidades | insumo, insumos, varejo, produto varejo |
| Páginas | `/estoque`, `/gestao/estoque`, dashboard estoque |
| Conceitos | estoque_atual, estoque_minimo, movimentação, conversão unidades, preço unitário, código de barras, PLU |
| Tabelas | `insumos`, `varejo`, `estoque_movimentacoes` |
| Hooks/Libs | useInsumos, useEstoqueOffline, offlineStorage (insumos), units.ts |

### Receitas (receitas.agent.md)

| Categoria | Termos |
|-----------|--------|
| Entidades | receita, receitas, composição, ingrediente |
| Páginas | `/receitas` |
| Conceitos | custo, custos invisíveis, rendimento, embalagem, categoria (massa/cobertura) |
| Tabelas | `receitas`, `composicao_receitas` |
| Hooks/Libs | useReceitasOffline, computeCosts, converters.ts |

### Padeiro / Caixa (agente-pdv)

| Categoria | Termos |
|-----------|--------|
| Entidades | caixa, vendas, caderneta, fiado |
| Páginas | `/caixa`, `/caixa/caderneta`, PDV |
| Conceitos | turno operador, formas de pagamento, balança, leitor código de barras |
| Hooks/Libs | useCaixa, useCaixaOffline, useVendasOffline, useCadernetaOffline |

### Sem especialista (resposta direta)

- Autenticação, permissões, RLS
- Configurações gerais (`/configuracoes`)
- Migrations sem domínio específico
- Deploy, CI/CD, infraestrutura
- Dúvidas gerais sobre o projeto

### Como classificar

1. Identificar substantivos principais na pergunta (ex: "receita", "insumo", "venda").
2. Verificar menção a rotas (`/estoque`, `/receitas`, etc.).
3. Em conflito, priorizar o verbo: "calcular custo da receita" → Receitas; "baixar estoque de insumo" → Estoque.
