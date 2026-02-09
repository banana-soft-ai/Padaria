# Referência — Agente Master Rey dos Pães

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

## Fases do Plano de Execução

```
FASE 1 — Banco/Infra (migrations, RLS, types)
FASE 2 — Backend (repositories, services, API routes)
FASE 3 — Offline (IndexedDB schemas, sync handlers)
FASE 4 — Frontend (componentes, páginas, hooks)
FASE 5 — PDV (se envolve caixa/caderneta/impressão)
FASE 6 — Testes (unitários, integração)
FASE 7 — Docs (atualizar documentação)
```

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
