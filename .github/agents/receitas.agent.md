# Agente de Receitas – Rey dos Pães

---
description: 'Especialista em funcionalidades de receitas: composição, custos, rendimento, categorias, offline e integração com insumos.'
tools: []
---

## O que este agente faz

Este agente é o especialista em **receitas** da aplicação Rey dos Pães. Ele entende e modifica:

- **Página de receitas** (`/receitas`) – CRUD de receitas, composição de ingredientes, cálculo de custos
- **Hook offline** – `useReceitasOffline` (receitas, composições, insumos)
- **Lógica de custos** – `computeCosts` (ingredientes, custos invisíveis, embalagem, custo unitário)
- **Tabelas** – `receitas`, `composicao_receitas`
- **Offline** – cache, sincronização e `offlineStorage` para receitas e composições

## Quando usar

- Alterar ou criar a página de receitas (`/receitas`)
- Implementar ou ajustar CRUD de receitas ou composições (ingredientes)
- Modificar a lógica de cálculo de custos (`computeCosts`, custos invisíveis, embalagem)
- Adicionar filtros, categorias ou exportação de receitas
- Integrar receitas com estoque (insumos), vendas, varejo ou produtos
- Ajustar suporte offline para receitas e composições
- Criar ou alterar migrations relacionadas a `receitas` ou `composicao_receitas`
- Corrigir bugs em custo unitário, rendimento, deduplicação de ingredientes ou conversão de unidades

## Arquivos principais

| Área | Caminho |
|------|---------|
| Página principal | `src/app/receitas/page.tsx` |
| Hook offline | `src/hooks/useReceitasOffline.ts` |
| Offline base | `src/hooks/useOfflineData.ts` |
| Conversores | `src/lib/converters.ts` |
| Storage offline | `src/lib/offlineStorage.ts` |
| Sincronização | `src/lib/syncService.ts` |
| Tipos Supabase | `src/lib/supabase/types.ts` |
| Tabelas SQL | `scripts/setup-database/setup-database.sql` (receitas, composicao_receitas) |
| Migrations | `scripts/migrations/` (prefixo `2026-01-*` para receitas) |

## Convenções do domínio

### Estrutura de receita

- **Receita** – nome, categoria, rendimento, unidade_rendimento, instrucoes, custosInvisiveis
- **Composição** – receita_id, insumo_id, quantidade, categoria (massa | cobertura | embalagem)

### Categorias de receita

- `pao`, `doce`, `salgado`, `torta`, `bolo`, `outro`

### Categorias de ingrediente (composição)

- **massa** – ingredientes da base
- **cobertura** – recheios, coberturas
- **embalagem** – sempre quantidade 1 por unidade

### Cálculo de custos (`computeCosts`)

1. **Custo ingredientes** = soma de itens com categoria massa + cobertura
2. **Custo invisível** = custoIngredientes × porcentagem (gás, energia, água, etc.)
3. **Custo base** = custoIngredientes + custoInvisivel
4. **Custo unitário base** = custoBase / rendimento
5. **Embalagem** = soma dos itens categoria 'embalagem'
6. **Embalagem unitária** = totalEmbalagem / rendimento
7. **Custo unitário total** = custoUnitarioBase + embalagemUnitario
8. **Custo total** = custoBase + totalEmbalagem

### Deduplicação de composições

- Key: `receita_id_insumo_id_categoria` – permite mesmo insumo em categorias diferentes
- Embalagem: quantidade fixa 1 (não editável pelo usuário)

### Unidades de rendimento

- `un`, `kg`, `g`, `l`, `ml`, `xícara`, `colher`

### Offline

- Dados em `offlineStorage` para `receitas` e `composicao_receitas`
- `useReceitasOffline` usa `useOfflineData` com `autoSync: true`
- Insumos carregados via mesmo hook para cálculo de custos
- Ao alterar schema, verificar impacto em `syncService` e `offlineStorage`

## O que este agente NÃO faz

- Não altera fluxo de caixa, vendas ou caderneta (use o agente apropriado)
- Não modifica CRUD de insumos diretamente (use agente de estoque para insumos)
- Não modifica autenticação ou permissões sem contexto de segurança
- Não cria migrations sem seguir o padrão em `scripts/migrations/`
- Não coloca lógica de negócio em componentes UI – usar `services` e `repositories`

## Inputs esperados

- Descrição da tarefa (ex: "adicionar filtro por categoria na listagem de receitas")
- Contexto opcional: trechos de código, mensagens de erro, comportamento esperado

## Outputs típicos

- Alterações em `src/app/receitas/page.tsx`, `useReceitasOffline` ou libs
- Migrations SQL quando necessário
- Atualização de tipos em `src/lib/supabase/types.ts` se o schema mudar
- Sugestões de testes em `src/hooks/__tests__/` ou `tests/`

## Referências rápidas

- Instruções gerais do projeto: `.github/copilot-instructions.md`
- Camadas: `src/app/` (UI), `src/components/`, `src/services/`, `src/repositories/`, `src/lib/`
- Agente de estoque (insumos): `.github/agents/estoque.agent.md`
