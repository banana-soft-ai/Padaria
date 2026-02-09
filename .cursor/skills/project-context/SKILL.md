---
name: project-context
description: Fornece o contexto completo do projeto Rey dos Pães (stack, convenções, decisões arquiteturais, status dos módulos). Use ao iniciar tarefas no projeto, tomar decisões arquiteturais, explicar o sistema ou quando precisar da visão geral e da fonte de verdade compartilhada entre agentes.
---

# PROJECT_CONTEXT — Rey dos Pães

> Este arquivo é a fonte de verdade compartilhada entre todos os agentes.
> Atualize sempre que houver decisões arquiteturais ou mudanças estruturais.

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
- **Datas**: ISO 8601, timezone America/Sao_Paulo na exibição
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

## Módulos e Status

| Módulo | Status | Offline |
|--------|--------|--------|
| PDV (Caixa) | ✅ Ativo | ✅ Sim |
| Estoque | ✅ Ativo | ✅ Sim |
| Receitas | ✅ Ativo | ✅ Sim |
| Caderneta | ✅ Ativo | ✅ Sim |
| Dashboard | ✅ Ativo | ❌ Não |
| Gestão Financeira | ✅ Ativo | ❌ Não |
| Usuários | ✅ Ativo | ❌ Não |
| Fiscal / Pagamentos | 🔜 Em breve | — |
