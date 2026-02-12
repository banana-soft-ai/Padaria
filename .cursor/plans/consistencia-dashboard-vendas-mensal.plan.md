---
name: consistencia-dashboard-vendas-mensal
overview: Corrigir discrepâncias entre Dashboard Administrativo e Relatórios de Vendas (Gestão - Vendas) para que os números mensais batam corretamente.
todos: [T1, T2, T3, T4, T5]
created: 2026-02-12
---

# Plano — Consistência Dashboard vs Vendas Mensal

## Causas identificadas

Com base na análise do código e nas imagens fornecidas:

1. **Unidades vendidas — erro de ponto flutuante**  
   Na Gestão/Vendas, `unidadesVendidas` é calculada somando `quantidade` em JavaScript sem arredondamento, gerando valores como `293.7799999999996`. O Dashboard usa `Math.round(somaItens * 100) / 100`.

2. **Período "Este mês" — possíveis diferenças de execução**  
   Dashboard usa API server-side (`obterDataLocal`/`obterInicioMes` no servidor) e Gestão Vendas usa client-side. Ambos usam `dateUtils`, mas servidor e cliente podem ter fusos diferentes em edge cases.

3. **Falta de filtro por status de venda**  
   Nenhuma das telas filtra `status = 'finalizada'`, então vendas canceladas entram nos totais. Se em algum momento um filtrar e outro não, haverá divergência.

4. **Ausência de serviço compartilhado**  
   Dashboard (API) e Gestão Vendas (client) implementam lógica própria de agregação. Qualquer mudança em um não se reflete no outro.

5. **Label do card "Média diária"**  
   O subtítulo exibe "X vendas" (total do período), o que pode confundir — sugere “média de vendas por dia”, mas mostra total.

## Plano de Execução

### Fase 1 — Backend (serviço compartilhado)

| ID | Tarefa | Agente | Arquivos | Depende de |
|----|--------|--------|----------|------------|
| T1 | Criar serviço/repository de métricas de vendas compartilhado | Backend | `src/services/vendasMetricas.service.ts`, `src/repositories/vendasMetricas.repository.ts` | — |

### Fase 2 — Backend (API + ajustes)

| ID | Tarefa | Agente | Arquivos | Depende de |
|----|--------|--------|----------|------------|
| T2 | Refatorar API Dashboard para usar serviço compartilhado | Backend | `src/app/api/dashboard/route.ts` | T1 |
| T3 | Filtrar vendas por `status = 'finalizada'` em métricas | Backend | `src/repositories/vendasMetricas.repository.ts`, `src/app/api/dashboard/route.ts` | T1 |

### Fase 3 — Frontend

| ID | Tarefa | Agente | Arquivos | Depende de |
|----|--------|--------|----------|------------|
| T4 | Usar API de métricas na Gestão Vendas (ou endpoint unificado) e corrigir arredondamento de unidades | Frontend | `src/app/gestao/vendas/page.tsx`, `src/components/gestao/VendasTab.tsx` | T2 |
| T5 | Ajustar label do card "Média diária" no Dashboard | Frontend | `src/app/gestao/dashboard/page.tsx` | — |

### Fase 4 — Testes

| ID | Tarefa | Agente | Arquivos | Depende de |
|----|--------|--------|----------|------------|
| T6 | Testes unitários para o serviço de métricas | Testes | `src/services/__tests__/vendasMetricas.service.test.ts` | T1 |

---

## Detalhamento das Tarefas

### Task T1 — Criar serviço/repository de métricas de vendas

**Agente:** agente-backend

**Briefing:**
---
**Objetivo:** Criar um serviço e repository centralizados para métricas de vendas (receita total, ticket médio, formas de pagamento, unidades vendidas) com período configurável.

**Arquivos a criar:**
- `src/repositories/vendasMetricas.repository.ts` — funções que consultam Supabase com paginação e retornam dados brutos
- `src/services/vendasMetricas.service.ts` — orquestra o repository e aplica regras (arredondamento, filtros)

**Contratos esperados:**
- `buscarMetricasPeriodo(dataInicio: string, dataFim: string)` retorna:
  - `receitaTotal`, `vendasCount`, `ticketMedio`, `unidadesVendidas` (arredondado 2 decimais)
  - `porFormaPagamento`: `{ pix, dinheiro, debito, credito, caderneta }`
- Filtrar vendas por `status = 'finalizada'` (ou `.neq('status', 'cancelada')` conforme regra de negócio)
- Usar coluna `data` (DATE) para filtro de período
- Paginação para evitar limite 1000 do Supabase
- Unidades vendidas: somar `venda_itens.quantidade` e arredondar com `Math.round(x * 100) / 100`

**Tabelas/RLS afetados:** `vendas`, `venda_itens` (somente leitura)

**Offline:** Não aplicável (métricas são consolidadas; offline pode continuar usando cache local como hoje)
---

**Linha para TASKS.md:** `- [ ] T1: Criar serviço métricas vendas — @agente-backend`

---

### Task T2 — Refatorar API Dashboard para usar serviço compartilhado

**Agente:** agente-backend

**Briefing:**
---
**Objetivo:** Fazer a rota `/api/dashboard` consumir `vendasMetricas.service.buscarMetricasPeriodo` para os totais e formas de pagamento, mantendo o mesmo contrato de resposta.

**Arquivos a alterar:** `src/app/api/dashboard/route.ts`

**Critérios:** A resposta JSON deve continuar com `vendasHoje`, `vendasMes`, `itensVendidosHoje`, `ticketMedioHoje`, `vendasPorPagamento` com os mesmos nomes/estrutura. Os valores devem vir do serviço centralizado.
---

**Linha para TASKS.md:** `- [ ] T2: Refatorar API Dashboard para serviço métricas — @agente-backend`

---

### Task T3 — Filtrar vendas por status nas métricas

**Agente:** agente-backend

**Briefing:**
---
**Objetivo:** Garantir que apenas vendas `status = 'finalizada'` entrem nas métricas. Vendas `cancelada` e `pendente` não devem ser contabilizadas.

**Arquivos:** `src/repositories/vendasMetricas.repository.ts` (e, se necessário, `src/app/gestao/vendas/page.tsx` para a parte client-side).

**Observação:** A página de Gestão Vendas carrega métricas direto do Supabase no client. Para consistência total, ou (a) criar um endpoint `/api/gestao/vendas/metricas` que use o serviço, ou (b) incluir `.eq('status', 'finalizada')` nas queries client-side. A opção (a) é preferível para fonte única.
---

**Linha para TASKS.md:** `- [ ] T3: Filtrar vendas finalizadas nas métricas — @agente-backend`

---

### Task T4 — Usar API de métricas na Gestão Vendas e corrigir arredondamento

**Agente:** agente-frontend

**Briefing:**
---
**Objetivo:**
1. Fazer a página Gestão - Vendas consumir o endpoint de métricas (ex.: `/api/gestao/vendas/metricas?dataInicio=...&dataFim=...`) quando online, em vez de calcular no client.
2. Arredondar `unidadesVendidas` para 2 decimais antes de exibir (fallback para lógica atual se endpoint não existir ainda).

**Arquivos a alterar:** `src/app/gestao/vendas/page.tsx`, possivelmente `src/components/gestao/VendasTab.tsx` (se receber unidades já formatadas)

**Critérios:**
- Unidades vendidas exibidas com no máximo 2 casas decimais (ex.: 293.78, nunca 293.7799999999996)
- Período (dia/semana/mes/etc.) mapeado para dataInicio/dataFim e enviado ao endpoint
- Manter fallback offline usando cache local
---

**Linha para TASKS.md:** `- [ ] T4: Gestão Vendas usar API métricas + arredondar unidades — @agente-frontend`

---

### Task T5 — Ajustar label do card "Média diária"

**Agente:** agente-frontend

**Briefing:**
---
**Objetivo:** O card "Média diária" no Dashboard mostra o total de vendas no subtítulo ("X vendas"), o que confunde. Alterar para algo como "Total de X vendas no período" ou "Média de R$ Y por dia em X vendas", conforme UX desejada.

**Arquivos:** `src/app/gestao/dashboard/page.tsx` (linhas ~319–322)

**Critérios:** O texto deve deixar claro que "X vendas" é o total do período, não a média diária de vendas.
---

**Linha para TASKS.md:** `- [ ] T5: Ajustar label card Média diária Dashboard — @agente-frontend`

---

### Task T6 — Testes unitários do serviço de métricas

**Agente:** agente-testes

**Briefing:**
---
**Escopo:** `src/services/vendasMetricas.service.ts` (e, se aplicável, repository)

**Cenários obrigatórios:**
- Retorna zeros quando não há vendas no período
- Calcula receitaTotal, vendasCount, ticketMedio corretamente com dados mockados
- Arredonda unidadesVendidas para 2 decimais
- Agrupa formas de pagamento corretamente
- Exclui vendas canceladas quando filtro aplicado
---

**Linha para TASKS.md:** `- [ ] T6: Testes métricas vendas — @agente-testes`

---

## Riscos e Observações

- **Reversão:** Nenhuma migration de schema. Reversão é reverter commits.
- **Offline:** Dashboard e Gestão Vendas têm fallback offline via cache. O serviço central afeta apenas o path online. Manter fallback com arredondamento consistente.
- **Fuso horário:** `obterDataLocal` e `obterInicioMes` em `dateUtils` já usam America/Sao_Paulo. Garantir que o endpoint de métricas receba `dataInicio` e `dataFim` em YYYY-MM-DD e que o client envie as mesmas datas que o Dashboard para o mesmo período "Este mês".

## Checklist Final

- [ ] Serviço de métricas criado e consumido pela API Dashboard
- [ ] Gestão Vendas usa endpoint de métricas (ou mesma lógica) e exibe unidades arredondadas
- [ ] Vendas canceladas excluídas das métricas
- [ ] Label do card "Média diária" ajustada
- [ ] Testes unitários do serviço passando
- [ ] `npm run build` e `npm test` verdes
