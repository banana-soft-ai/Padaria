# Índice de Agentes — Rey dos Pães

> Referência central para escolher qual agente (skill) usar. Atualizado em 2026-02-09.

## Visão geral

| Agente | Quando usar | Quando NÃO usar | Skill |
|--------|-------------|------------------|-------|
| **Master** | Planejamento de features, tarefas complexas, várias camadas, refatorações que afetam múltiplos módulos | Tarefa simples e de um único domínio | `.cursor/skills/master-agent/` |
| **Frontend** | UI, componentes, páginas, hooks, formulários (RHF+Zod), Tailwind, loading/error/empty, a11y | Só API/migration; caixa/caderneta/impressão (PDV); IndexedDB/sync | `.cursor/skills/agente-frontend/` |
| **Backend** | API routes, services, repositories, Supabase, RLS, migrations, tipos, validação Zod | Só UI; só testes; só docs; IndexedDB/Service Worker | `.cursor/skills/agente-backend/` |
| **Offline** | IndexedDB, syncService, Service Worker, PWA, hooks useOffline*, página /offline | Só UI ou só API; fluxo PDV sem mudar sync | `.cursor/skills/offline-sync/` |
| **PDV** | Caixa, vendas, caderneta, impressão Elgin, balança Toledo, leitor código de barras | Gestão/dashboard/relatórios; só API/RLS; só sync | `.cursor/skills/agente-pdv/` |
| **Testes** | Testes unitários/integração, Jest, Testing Library, mocks, cobertura | Implementar features; E2E; testes de carga; só documentação | `.cursor/skills/agente-testes/` |
| **Refatoração** | DRY, tipagem, performance, extrair hooks/componentes, código morto | Nova feature; mudar comportamento; só testes/docs | `.cursor/skills/agente-refatoracao/` |
| **Docs** | docs/, README, JSDoc, changelogs, guias operadores, API | Implementar código; testes | `.cursor/skills/agente-documentacao/` |
| **Tasks** | Atualizar docs/TASKS.md, mover tarefas, sprint, arquivar | Alterar código do projeto | `.cursor/skills/agente-tasks/` |
| **CI/CD** | GitHub Actions, lint, typecheck, test, build, gates de merge | Alterar código de produção; só testes | `.cursor/skills/ci-cd-qualidade/` |
| **Project-context** | Iniciar tarefa, decisão arquitetural, visão geral, convenções | Executar tarefa de implementação (usar como contexto) | `.cursor/skills/project-context/` |

## Fluxo recomendado

1. **Dúvida de agente?** → Use **Master** para análise e delegação.
2. **Tarefa clara e um domínio?** → Use o agente da tabela acima.
3. **Várias camadas (banco + API + UI + offline)?** → **Master** gera o plano; execute por fases com os subagentes indicados.

## Referências detalhadas

- **Templates de briefing, DoD, roteamento por intenção:** [.cursor/skills/master-agent/reference.md](../.cursor/skills/master-agent/reference.md)
- **Cenários de teste por módulo, mocks, cobertura:** [.cursor/skills/agente-testes/reference.md](../.cursor/skills/agente-testes/reference.md)
- **Schema IndexedDB, conflitos, fila de sync:** [.cursor/skills/offline-sync/reference.md](../.cursor/skills/offline-sync/reference.md)
- **Contexto do projeto (stack, convenções, glossário):** skill **project-context**
