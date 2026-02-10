---
name: project-context
description: Fornece o contexto completo do projeto Rey dos Pães (stack, convenções, decisões arquiteturais, status dos módulos). Use ao iniciar tarefas no projeto, tomar decisões arquiteturais, explicar o sistema ou quando precisar da visão geral e da fonte de verdade compartilhada entre agentes.
---

# PROJECT_CONTEXT — Rey dos Pães

> Este arquivo é a fonte de verdade compartilhada entre todos os agentes.
> Atualize sempre que houver decisões arquiteturais ou mudanças estruturais.

---

## Glossário (termos do domínio)

| Termo | Significado |
|------|-------------|
| **Caderneta** | Crédito/fiado do cliente: compra a prazo, limite de crédito, saldo devedor, pagamentos |
| **Centavos** | Valores monetários no código são sempre inteiros em centavos (ex.: R$ 10,50 = 1050) |
| **EAN-13 peso variável** | Código de barras da balança Toledo Prix: prefixo 2 + código produto (5) + peso (5 dígitos em gramas) + dígito verificador |
| **Fiado** | Sinônimo de caderneta (dívida do cliente) |
| **obterDataLocal()** | Função em `@/lib/dateUtils` para data operacional em America/Sao_Paulo; usar em vendas, caixa, caderneta |
| **PLU** | Price Look-Up; código numérico de produto (balança/varejo) |
| **RLS** | Row Level Security (Supabase/PostgreSQL); políticas por linha |
| **Sync** | Sincronização de dados locais (IndexedDB) com Supabase ao reconectar |

---

## Projeto

- **Nome**: Rey dos Pães
- **Tipo**: Sistema de gestão para padaria (ERP simplificado)
- **Status**: Em desenvolvimento ativo

## Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS 3.4, Headless UI, Lucide React |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| Formulários | React Hook Form + Zod |
| Gráficos | Recharts |
| Barcode | @zxing/browser, BarcodeDetector |
| Testes | Jest + Testing Library |
| Deploy | Railway / Docker / Vercel |
| Offline | IndexedDB + Service Worker |

## Convenções

- **Moeda**: centavos internamente, BRL formatado na UI
- **Datas**: ISO 8601 (YYYY-MM-DD); timezone America/Sao_Paulo. Todas as datas operacionais (vendas, caixa, caderneta, dashboard) usam `obterDataLocal()` de `@/lib/dateUtils` — nunca `new Date().toISOString().split('T')[0]` (UTC)
- **IDs**: UUID v4 (gerados no client para suporte offline)
- **Roles**: admin, gerente, funcionario, caixa
- **Idioma do código**: inglês para variáveis/funções, português para mensagens ao usuário
- **Commits**: `tipo(escopo): descrição` em português

## Decisões Arquiteturais

| Data | Decisão | Motivo |
|------|---------|--------|
| — | Offline-first com IndexedDB | Padaria tem internet instável |
| — | Supabase em vez de API própria | Velocidade de desenvolvimento, RLS nativo |
| — | Impressão via serviço local Node | Navegador não permite print direto na Elgin i9 |
| — | EAN-13 peso variável (Toledo Prix) | Padrão da balança já em uso na padaria |
| — | Datas operacionais em America/Sao_Paulo via obterDataLocal() | Evita vendas à noite serem gravadas com data do dia seguinte (UTC) |

## Módulos e Status

| Módulo | Status | Offline | Agente principal (skill) |
|--------|--------|--------|---------------------------|
| PDV (Caixa) | ✅ Ativo | ✅ Sim | agente-pdv |
| Estoque | ✅ Ativo | ✅ Sim | agente-backend + regras .cursor/rules/estoque.mdc |
| Receitas | ✅ Ativo | ✅ Sim | agente-backend |
| Caderneta | ✅ Ativo | ✅ Sim | agente-pdv |
| Dashboard | ✅ Ativo | ❌ Não | agente-frontend |
| Gestão Financeira | ✅ Ativo | ❌ Não | agente-frontend / agente-backend |
| Usuários | ✅ Ativo | ❌ Não | agente-backend |
| Fiscal / Pagamentos | 🔜 Em breve | — | — |

## Referências por domínio (skills com reference.md)

- **Orquestração, planos, briefing:** [master-agent/reference.md](.cursor/skills/master-agent/reference.md)
- **Testes, mocks, cenários, cobertura:** [agente-testes/reference.md](.cursor/skills/agente-testes/reference.md)
- **Offline, IndexedDB, sync, conflitos:** [offline-sync/reference.md](.cursor/skills/offline-sync/reference.md)

Índice completo de agentes (quando usar, quando não usar): ver `docs/agents-index.md` ou `.cursor/plans/` para planos.
