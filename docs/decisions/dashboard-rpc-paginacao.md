# Decisão: Dashboard sem limite de vendas (RPC + paginação)

**Data:** 2026-02-12

## Motivo

O cliente Supabase aplica limite padrão de 1000 linhas por query. O dashboard (filtros "Este mês", "7 dias") buscava todas as vendas do período em uma única chamada; com mais de 1000 vendas, os dias finais apareciam zerados e os cards/top produtos ficavam incompletos.

## Solução adotada

- **Gráfico "Vendas por dia":** RPC no Postgres `get_vendas_por_dia(inicio, fim)` que retorna totais agregados por dia (até ~90 linhas). Migration: `scripts/migrations/2026-02-12-rpc-get-vendas-por-dia.sql`.
- **Vendas do período (totais, top produtos, formas de pagamento):** paginação em lotes de 1000 na API (`src/app/api/dashboard/route.ts`) até trazer todas as vendas do intervalo.

## Referências

- **Migration:** `scripts/migrations/2026-02-12-rpc-get-vendas-por-dia.sql`
- **API:** `src/app/api/dashboard/route.ts` (RPC para gráfico; loop com `.range()` para vendas do período)

## Reversão

Reverter alterações em `route.ts` (duas queries diretas em `vendas` como antes). No banco: `DROP FUNCTION IF EXISTS public.get_vendas_por_dia(date, date);`
