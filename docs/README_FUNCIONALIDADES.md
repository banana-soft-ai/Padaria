# Rey dos Pães – Funcionalidades do Sistema

Documento de referência para manutenção. **Atualizado em:** 31/01/2025

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Operacional (Colaborador)](#operacional-colaborador)
3. [Administrador](#administrador)
4. [Sistema](#sistema)
5. [Infraestrutura Offline](#infraestrutura-offline)
6. [Permissões e Rotas](#permissões-e-rotas)
7. [Dicas para Manutenção](#dicas-para-manutenção)

---

## Visão Geral

O sistema é dividido em dois blocos de menu:

- **Colaborador:** Vendas (PDV), Receitas, Estoque, Configurações
- **Administrador:** Dashboard, Caixas, Saídas, Vendas, Preços, Operadores, Gestão Financeira, Usuários

Rotas administrativas exigem desbloqueio (ícone cadeado) ou role `admin`/`gerente`.

**Stack:** Next.js 15, React 19, TypeScript, Supabase (Postgres + RLS)

---

## Operacional (Colaborador)

### Vendas (PDV) – `/caixa`

**Arquivo:** `src/app/caixa/page.tsx`

- **Objetivo:** Ponto de venda principal do sistema.
- **Fluxo:** Abrir caixa → Registrar vendas → Fechar caixa.
- **Formas de pagamento:** Dinheiro, Débito, Crédito, Pix, Caderneta (fiado).
- **Código de barras:**
  - **Leitor USB (keyboard wedge):** Captura global quando foco está fora de input.
  - **Scanner de câmera:** Modal com BarcodeDetector nativo ou ZXing.
  - **Integração balança Toledo Prix:** EAN-13 com prefixos 20–29.
- **Caderneta:** Vendas fiado vinculadas a clientes; saldo devedor atualizado.
- **Cupom fiscal:** Na view Relatórios, ao clicar em Imprimir para uma venda, abre-se um modal: é possível **imprimir direto** (sem dados do consumidor) ou **imprimir com dados do cliente** (Nome e CPF opcionais, exibidos no bloco CONSUMIDOR do cupom).
- **Turno operador:** Troca de operador via `TurnoOperadorModal`.
- **Offline:** `useCaixaOffline`, `useVendasOffline`, `useCadernetaOffline`.
- **Docs detalhados:** `docs/app-pages/page-caixa-fluxo-codigo-barras.md`

---

### Caderneta – `/caixa/caderneta`

**Arquivo:** `src/app/caixa/caderneta/page.tsx`

- **Objetivo:** Gestão de crédito (fiado) dos clientes.
- **Funcionalidades:** CRUD de clientes, registro de pagamentos, ajuste de saldo.
- **Validação:** Pagamento só é permitido se o caixa do dia estiver aberto.
- **Offline:** `useCadernetaOffline` – dados em IndexedDB e sincronização ao voltar online.
- **Docs detalhados:** `docs/app-pages/page-caderneta.md`

---

### Receitas – `/receitas`

**Arquivo:** `src/app/receitas/page.tsx`

- **Objetivo:** Cadastro de receitas e composição (ingredientes).
- **Funcionalidades:** CRUD de receitas, ingredientes por categoria, custo calculado.
- **Unidades:** `convertToBaseQuantity`, `getUnidadeMinima` (`@/lib/units`).
- **Offline:** `useReceitasOffline`.

---

### Estoque – `/gestao/estoque`

**Arquivo:** `src/app/gestao/estoque/page.tsx`

- **Objetivo:** Gestão de insumos e produtos de varejo.
- **Tipos:** Insumos (matéria-prima) e Varejo (produtos vendidos).
- **Campos:** `codigo_barras`, `codigo_balanca` (produtos de balança Toledo Prix).
- **Status:** Sem estoque, estoque baixo, em estoque.
- **Unidades:** `convertToBaseQuantity`, `calculatePrecoUnitario` (`@/lib/units`).
- **Regra Cursor:** `.cursor/rules/estoque.mdc`

---

### Dashboard de Estoque (somente leitura)

**Arquivo:** `src/app/estoque/page.tsx` (se existir)

- **Objetivo:** Visualização rápida do estoque (sem edição).
- **Filtros:** Por status, busca por nome.
- **Docs detalhados:** `docs/app-pages/page-estoque.md`

---

### Configurações – `/configuracoes`

**Arquivo:** `src/app/configuracoes/page.tsx`

- **Objetivo:** Exibir dados do usuário logado, status do sistema e logout.
- **Docs detalhados:** `docs/app-pages/page-configuracoes.md`

---

## Administrador

### Dashboard – `/gestao/dashboard`

**Arquivo:** `src/app/gestao/dashboard/page.tsx`

- **Objetivo:** Visão geral do negócio.
- **Dados:** Vendas do dia/mês, ticket médio, gráficos (Recharts), top produtos, vendas por forma de pagamento.
- **API:** `/api/dashboard` – agregação de vendas, caixa_diario, venda_itens.
- **Offline:** Fallback com cache IndexedDB.

---

### Caixas – `/gestao/caixas`

**Arquivo:** `src/app/gestao/caixas/page.tsx`

- **Objetivo:** Histórico de caixas diários.
- **Filtros:** Por período (semana, mês).
- **Totais:** Entradas, saídas, diferença, por forma de pagamento.
- **Componente:** `CaixasTab`.

---

### Saídas – `/gestao/saidas`

**Arquivo:** `src/app/gestao/saidas/page.tsx`

- **Objetivo:** Registro e consulta de saídas de caixa (`fluxo_caixa`).
- **Categoria:** `caixa` (sangrias, etc.).
- **Totais:** Dia, semana, mês.

---

### Vendas – `/gestao/vendas`

**Arquivo:** `src/app/gestao/vendas/page.tsx`

- **Objetivo:** Relatórios e ranking de vendas.
- **Períodos:** Dia, semana, mês, trimestre, semestre, ano.
- **Métricas:** Unidades vendidas, receita, ticket médio, por forma de pagamento.
- **Componente:** `VendasTab`.
- **Offline:** Fallback com cache IndexedDB.

---

### Preços – `/gestao/precos`

**Arquivo:** `src/app/gestao/precos/page.tsx`

- **Objetivo:** Gestão de preços de venda (receitas e varejo).
- **Funcionalidades:** Editar preço, margem, custo unitário; ranking de vendas para sugestão.
- **Cálculo de custo:** `calcularCustoSeguroFromComposicoes` (`@/lib/preco`).
- **Componentes:** `PrecosTab`, `PrecoModal`.

---

### Operadores – `/gestao/operadores`

**Arquivo:** `src/app/gestao/operadores/page.tsx`

- **Objetivo:** Turnos de operadores e colaboradores.
- **Abas:** Turnos, Desempenho, Colaboradores.
- **Dados:** Saldo inicial, vendas, sangrias, saldo esperado vs contado, itens vendidos.
- **Repositório:** `turnoOperadorRepository`, `turnoOperadorService`.

---

### Gestão Financeira (Lucratividade) – `/gestao/lucro`

**Arquivo:** `src/app/gestao/lucro/page.tsx`

- **Objetivo:** Análise de lucratividade por produto.
- **Funcionalidades:** Custos fixos, margem bruta/líquida, ROI.
- **Service:** `lucratividadeService` – `processarLucratividadePorProduto`.

---

### Código de Barras (standalone) – `/codigo-barras`

**Arquivo:** `src/app/codigo-barras/page.tsx`

- **Objetivo:** PDV alternativo focado em scanner (câmera + digitação).
- **Nota:** Pode usar dados simulados; PDV principal está em `/caixa`.
- **Docs detalhados:** `docs/app-pages/page-codigo-barra.md`

---

### Em breve

- **Fiscal e Contábil** – `/gestao/fiscal`
- **Pagamento e Planos** – `/sistema/pagamentos`

---

## Sistema

### Usuários – `/sistema/usuarios`

**Arquivo:** `src/app/sistema/usuarios/page.tsx`

- **Objetivo:** CRUD de usuários do sistema.
- **Roles:** admin, gerente, funcionario, caixa.
- **Actions:** `criarUsuarioAuth` (Server Action) para criar usuário no Auth do Supabase.

---

## Infraestrutura Offline

- **Hooks:** `useEstoqueOffline`, `useReceitasOffline`, `useCadernetaOffline`, `useCaixaOffline`, `useVendasOffline`
- **Storage:** IndexedDB via `offlineStorage` (`@/lib/offlineStorage`)
- **Sync:** `syncService` – sincronização ao voltar online
- **Conflitos:** `ConflictResolver` para resolver divergências
- **Docs:** `docs/offline/SISTEMA_OFFLINE_INTEGRADO.md`, `docs/offline/OFFLINE_SYSTEM.md`

---

## Permissões e Rotas

**Arquivo:** `src/lib/permissions.ts`

| Tipo | Rotas | Quem acessa |
|------|-------|-------------|
| Operacionais | `/caixa`, `/receitas`, `/estoque`, `/gestao/estoque`, `/configuracoes` | Todos logados |
| Administrativas | `/gestao`, `/sistema` | admin/gerente ou menu desbloqueado |
| Bloqueadas | `/gestao/fiscal`, `/sistema/pagamentos` | Em breve |

**Menu:** `src/lib/menuConfig.ts` – define blocos e itens do menu lateral.

---

## Dicas para Manutenção

1. **Atualizar este README** sempre que adicionar/remover funcionalidade ou alterar fluxo importante.
2. **Documentação por página:** Use `docs/app-pages/` para páginas complexas; mantenha padrão: objetivo, funcionalidades, fluxo, hooks/repos.
3. **Regras do Cursor:** Crie `.cursor/rules/*.mdc` para módulos críticos (ex.: caixa, caderneta).
4. **Tipos centralizados:** Mantenha `src/types/` e `src/lib/supabase/types.ts` alinhados ao schema.
5. **Services e repositories:** Lógica de negócio em `services/`, acesso a dados em `repositories/`.
6. **Changelog:** Mantenha `implementações-dia.md` ou `CHANGELOG.md` com alterações relevantes.
7. **Diagramas de fluxo:** Para fluxos críticos (PDV, caderneta), mantenha diagramas em `docs/`.
8. **Testes:** Priorize `lib/preco.ts`, `converters`, services críticos; hooks em `hooks/__tests__/`.
9. **Variáveis de ambiente:** Documente em `docs/setup/`; nunca use `NEXT_PUBLIC_` para chaves sensíveis.
10. **Migrations:** Ao alterar schema, crie migration em `scripts/migrations/` e atualize `docs/setup/`.
