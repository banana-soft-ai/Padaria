# Timezone e Datas Operacionais

## Regra Central

Todas as datas operacionais (vendas, caixa, caderneta, dashboard) usam **timezone America/Sao_Paulo** via `obterDataLocal()` de `@/lib/dateUtils`.

## Motivo

O uso de `new Date().toISOString().split('T')[0]` retorna a data em **UTC**. Em São Paulo (UTC-3), vendas feitas após ~21h são gravadas com o dia seguinte. Exemplo: venda às 22h em 08/02 vira `data = "2026-02-09"`.

## Funções Disponíveis

| Função | Descrição | Uso |
|--------|-----------|-----|
| `obterDataLocal()` | Data de hoje em YYYY-MM-DD (São Paulo) | Criar vendas, abrir caixa, filtros "hoje" |
| `obterInicioMes()` | Primeiro dia do mês atual (São Paulo) | Filtros mensais |
| `obterInicioSemana()` | Segunda-feira da semana atual | Filtros semanais |
| `obterDataNDiasAtras(n)` | Data N dias atrás (São Paulo) | Gráficos, ranges |

## O Que Evitar

```ts
// ❌ Nunca usar para datas operacionais
const hoje = new Date().toISOString().split('T')[0]
```

```ts
// ✅ Usar sempre
import { obterDataLocal } from '@/lib/dateUtils'
const hoje = obterDataLocal()
```
