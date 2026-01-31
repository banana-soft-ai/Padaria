# Rey dos Pães — Sistema de Gestão para Padaria

> Sistema completo de gestão operacional e financeira para padarias, com suporte offline, PDV integrado e sincronização em tempo real.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

---

## Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Stack Tecnológico](#stack-tecnológico)
- [Funcionalidades](#funcionalidades)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Deploy](#deploy)
- [Segurança](#segurança)
- [Documentação](#documentação)
- [Licença](#licença)

---

## Visão Geral

O **Rey dos Pães** é um sistema de gestão desenvolvido para padarias, cobrindo o ciclo completo: desde o cadastro de insumos e receitas até o PDV (Ponto de Venda), controle de caixa, caderneta de clientes e relatórios gerenciais. O sistema foi projetado para funcionar **online e offline**, garantindo continuidade operacional mesmo em ambientes com conectividade instável.

### Diferenciais

- **Modo offline completo** — Vendas, estoque, receitas e caderneta funcionam sem internet
- **Sincronização automática** — Dados locais sincronizam ao reconectar
- **PWA** — Instalável em dispositivos móveis e desktops
- **Integração com balança** — Leitura de códigos EAN-13 (Toledo Prix)
- **Impressão direta** — Cupom fiscal na Elgin i9 sem diálogo do navegador
- **Controle de turno** — Operador e caixa por sessão

---

## Arquitetura

O projeto segue uma arquitetura em camadas com separação clara de responsabilidades:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│  src/app/ (Next.js App Router) • src/components/ • hooks/       │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BUSINESS LAYER                            │
│  src/services/ • src/repositories/ • src/lib/ (utils, config)    │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
│  Supabase (PostgreSQL) • IndexedDB (offline) • syncService       │
└─────────────────────────────────────────────────────────────────┘
```

### Camadas

| Camada | Responsabilidade | Localização |
|--------|------------------|-------------|
| **Presentation** | UI, páginas, componentes React, hooks | `src/app/`, `src/components/`, `src/hooks/` |
| **Business** | Regras de negócio, serviços, repositórios | `src/services/`, `src/repositories/`, `src/lib/` |
| **Data** | Persistência, Supabase, IndexedDB, sincronização | `src/lib/supabase/`, `src/lib/offlineStorage.ts`, `src/lib/syncService.ts` |

### Fluxo Offline

1. **Online** — Dados vão direto ao Supabase; cache local é atualizado em paralelo
2. **Offline** — Operações são persistidas no IndexedDB e enfileiradas para sync
3. **Reconexão** — `syncService` processa a fila, resolve conflitos e notifica o usuário

---

## Stack Tecnológico

| Categoria | Tecnologia |
|-----------|------------|
| **Framework** | Next.js 15 (App Router) |
| **UI** | React 19, Tailwind CSS 3.4, Headless UI, Lucide React |
| **Backend** | Supabase (PostgreSQL, Auth, RLS) |
| **Formulários** | React Hook Form, Zod |
| **Gráficos** | Recharts |
| **Código de barras** | @zxing/browser, BarcodeDetector (nativo) |
| **Testes** | Jest, Testing Library |
| **Deploy** | Railway, Docker, Vercel |

---

## Funcionalidades

### Operacional (Colaborador)

| Módulo | Funcionalidades |
|--------|-----------------|
| **PDV (Caixa)** | Vendas com múltiplas formas de pagamento (Dinheiro, Débito, Crédito, PIX, Caderneta), leitor USB e scanner de câmera, códigos de balança (EAN-13 peso variável), impressão de cupom, abertura/fechamento de caixa |
| **Receitas** | Cadastro de receitas, composição (massa, cobertura, embalagem), cálculo de custo, rendimento, categorias (pão, doce, salgado, torta, bolo) |
| **Estoque** | Insumos e varejo unificados, preços unitários, alertas de estoque mínimo, código de barras, código balança (Toledo Prix) |
| **Caderneta** | Clientes fiéis, limite de crédito, saldo devedor/credor, movimentações, pagamentos |
| **Configurações** | Perfil do usuário, informações do sistema, logout |

### Administrativo (Admin/Gerente)

| Módulo | Funcionalidades |
|--------|-----------------|
| **Dashboard** | Indicadores, estatísticas, visão geral |
| **Caixas** | Histórico de abertura/fechamento, movimentações |
| **Saídas** | Registro de saídas financeiras |
| **Vendas** | Histórico completo, filtros, detalhes |
| **Preços** | Gestão de preços de venda e custo |
| **Operadores** | Turno e operador por sessão |
| **Estoque** | Gestão avançada, `codigo_balanca` |
| **Gestão Financeira** | Margem de lucro, fluxo de caixa, lucratividade |
| **Usuários** | Gestão de usuários do sistema |
| **Fiscal / Pagamentos** | Em breve |

### Sistema

| Funcionalidade | Descrição |
|----------------|-----------|
| **Autenticação** | Supabase Auth, roles (admin, gerente, funcionario, caixa) |
| **Permissões** | RLS, RouteGuard, AuthGuard, desbloqueio admin |
| **Offline** | IndexedDB, Service Worker, sincronização, resolução de conflitos |
| **PWA** | Manifest, precache, instalável |
| **Impressão local** | Serviço Node.js para Elgin i9 (cupom direto na impressora) |

---

## Estrutura do Projeto

```
rey-dos-paes/
├── src/
│   ├── app/                    # Páginas (Next.js App Router)
│   │   ├── api/                # Rotas API (dashboard, health, logs, env)
│   │   ├── caixa/              # PDV e caderneta no caixa
│   │   ├── codigo-barras/      # Gestão de códigos
│   │   ├── configuracoes/
│   │   ├── estoque/
│   │   ├── gestao/             # Dashboard, caixas, vendas, precos, etc.
│   │   ├── login/ logout/
│   │   ├── offline/            # Página offline
│   │   ├── receitas/
│   │   ├── sistema/            # Usuários, pagamentos
│   │   └── vendas/
│   ├── components/             # Componentes reutilizáveis
│   │   ├── caixa/              # Modais, resumo, status
│   │   ├── caderneta/
│   │   ├── gestao/
│   │   └── vendas/
│   ├── hooks/                  # Custom hooks (incl. offline)
│   ├── lib/                    # Utilitários, Supabase, sync, preco
│   ├── repositories/           # Acesso a dados
│   ├── services/               # Lógica de negócio
│   └── types/                  # Tipos TypeScript
├── public/                     # sw.js, manifest.json, ícones
├── scripts/
│   ├── migrations/             # Migrações SQL
│   ├── tabelas/                # DDL
│   ├── js/                     # Scripts Node (setup-admin, etc.)
│   └── ...
├── servicos/
│   └── impressao-local/        # Serviço de impressão Elgin i9
├── docs/                       # Documentação
├── tests/
├── docker-compose.yml
├── Dockerfile
├── railway.json
└── package.json
```

---

## Pré-requisitos

- **Node.js** ≥ 20.0.0
- **npm** ≥ 10.0.0
- Conta no [Supabase](https://supabase.com)

---

## Instalação

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd rey-dos-paes
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Execute os scripts em `scripts/tabelas/` e `scripts/migrations/` no SQL Editor
3. Anote a URL e as chaves (anon, service_role)

### 4. Configure as variáveis de ambiente

Crie `.env.local` na raiz (veja [Variáveis de Ambiente](#variáveis-de-ambiente)).

### 5. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:3000`.

### 6. (Opcional) Impressão local — Elgin i9

Para imprimir cupom direto na impressora (sem diálogo do navegador):

```bash
npm run impressao-local
```

O serviço escuta em `http://127.0.0.1:3333`. Detalhes em `servicos/impressao-local/README.md`.

---

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anônima (pode ser exposta) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim (server) | Service Role Key — **nunca** expor no client |
| `SUPABASE_URL` | Sim (server) | URL do Supabase |
| `SUPABASE_ANON_KEY` | Sim (server) | Chave anônima |
| `DATABASE_URL` | Sim (server) | Connection string PostgreSQL |
| `JWT_SECRET` | Sim (server) | Chave para assinatura de JWTs |

Exemplo mínimo de `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima

SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anonima
DATABASE_URL=postgres://...
JWT_SECRET=string_aleatoria_segura
```

---

## Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Inicia o servidor (usa `server.js`) |
| `npm run lint` | ESLint |
| `npm run test` | Jest |
| `npm run test:watch` | Jest em modo watch |
| `npm run test:coverage` | Jest com cobertura |
| `npm run check-env` | Verifica variáveis de ambiente |
| `npm run setup-admin` | Configura usuário admin |
| `npm run impressao-local` | Serviço de impressão local |

---

## Deploy

### Railway (recomendado)

1. Conecte o repositório ao Railway
2. Configure as variáveis de ambiente
3. Deploy automático a cada push

Guia detalhado: `docs/deploy/GUIA_DEPLOY_RAILWAY.md`

### Docker

```bash
docker build -t rey-dos-paes:latest .
docker run --env-file .env.local -p 8080:8080 rey-dos-paes:latest
```

### Vercel

Compatível com Next.js. Configure as variáveis de ambiente no painel.

---

## Segurança

- **Row Level Security (RLS)** — Todas as tabelas com políticas de acesso
- **Autenticação** — Supabase Auth com sessões seguras
- **Roles** — admin, gerente, funcionario, caixa com permissões distintas
- **RouteGuard** — Proteção de rotas no client
- **Variáveis sensíveis** — Nunca usar `NEXT_PUBLIC_` para chaves secretas

---

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| `docs/app-pages/` | Fluxos das páginas (caixa, caderneta, estoque, etc.) |
| `docs/offline/` | Sistema offline, sincronização, IndexedDB |
| `docs/deploy/` | Deploy Railway, Docker |
| `docs/setup/` | Setup do banco de dados |
| `servicos/impressao-local/README.md` | Serviço de impressão Elgin i9 |

---

## Licença

Este projeto está sob a licença MIT.

---

**Desenvolvido para a Padaria Rey dos Pães**
