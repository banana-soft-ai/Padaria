# Referência — Agente Offline & Sincronização

## Stores do IndexedDB

Cada módulo offline possui um store. Nomes e direção de sync:

| Store | Dados | Sync bidirecional |
|-------|-------|--------------------|
| `produtos` | Catálogo completo | Sim |
| `vendas` | Vendas realizadas | Push (local → server) |
| `vendas_itens` | Itens de cada venda | Push |
| `caixa_sessoes` | Abertura/fechamento | Push |
| `caderneta_clientes` | Clientes e saldos | Sim |
| `caderneta_movimentos` | Movimentações | Push |
| `receitas` | Receitas e composições | Pull (server → local) |
| `sync_queue` | Fila de operações pendentes | — |

Nota: o código atual pode usar `pendingOperations` e `offlineData`; a migração para stores nomeados e `sync_queue` segue este contrato.

---

## Contrato da fila de sincronização

```typescript
interface SyncQueueItem {
  id: string
  tabela: string
  operacao: 'INSERT' | 'UPDATE' | 'DELETE'
  dados: Record<string, unknown>
  timestamp: string          // ISO 8601
  tentativas: number
  status: 'pendente' | 'processando' | 'erro' | 'concluido'
  erro?: string
}
```

Processar fila em ordem cronológica (por `timestamp`). Retry: incrementar `tentativas` em falha; após limite (ex.: 5), marcar `status: 'erro'` e notificar.

---

## Resolução de conflitos

| Cenário | Estratégia |
|---------|-----------|
| Mesmo registro editado online e offline | Last Write Wins (timestamp mais recente) |
| Venda criada offline | Sempre aceitar (push) — venda é imutável |
| Estoque alterado dos dois lados | Somar deltas (não sobrescrever) |
| Cliente caderneta editado | Last Write Wins + notificar usuário |

---

## Cenários de teste obrigatórios

- [ ] Criar venda offline → reconectar → venda aparece no Supabase
- [ ] Editar estoque offline e online → reconectar → conflito resolvido
- [ ] App carrega sem internet (Service Worker serve cache)
- [ ] Fila de sync processa em ordem cronológica
- [ ] Falha de sync → retry → sucesso eventual
- [ ] Página `/offline` aparece quando sem cache e sem rede
- [ ] PWA instalável e funcional

---

## Estratégias de cache (Service Worker)

| Recurso | Estratégia |
|---------|-----------|
| HTML/JS/CSS (assets) | Cache First, fallback network |
| Imagens | Cache First com expiração (7 dias) |
| API GET | Network First, fallback cache |
| API POST/PUT/DELETE | Network Only + queue offline |
| Fontes | Cache First (longa duração) |

Precache: `/caixa`, `/estoque`, `/receitas`, `/offline` (fallback), assets estáticos do build.
