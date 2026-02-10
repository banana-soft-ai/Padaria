# Referência — Agente de Testes Rey dos Pães

> Atualizado em: 2026-02-09

## Cenários obrigatórios por módulo (mapeamento)

Ao testar um arquivo ou funcionalidade, usar os cenários da checklist abaixo conforme o módulo. Módulos novos: alinhar com Master/Docs e adicionar aqui.

| Módulo / Código | Cenários obrigatórios (ver checklist abaixo) |
|-----------------|---------------------------------------------|
| `vendaService`, `vendaRepository`, fluxo venda | PDV/Vendas (todos) + Cálculos (decodificação EAN-13, centavos) |
| `caixa*`, sessão caixa | Caixa (todos) |
| `caderneta*`, cliente fiado | Caderneta (todos) |
| `estoque*`, movimentações | Estoque (todos) + PDV (dedução após venda) |
| `offlineStorage`, `syncService`, hooks `useOffline*` | Offline/Sync (todos) |
| `preco.ts`, custo receita, margem | Cálculos (todos) |
| `ean13.ts`, balança | Cálculos (decodificação EAN-13, arredondamento) |
| Componentes caixa/caderneta | PDV/Vendas + Caixa/Caderneta (happy path + erro) |

## Fixtures (dados reutilizáveis)

- **Pasta:** `tests/fixtures/`
- **Convenção:** um arquivo por entidade ou fluxo; exportar objetos/arrays tipados. Ex.: `vendaValida.ts`, `clienteCaderneta.ts`, `produtoBalanca.ts`
- **Uso:** importar nos testes para Arrange; evita repetição e garante dados consistentes.

## Cobertura por camada (metas)

| Camada | Meta mínima | Observação |
|--------|-------------|------------|
| Services | 80% | Regras de negócio; crítico para bugs |
| Repositories | 70% | Acesso a dados; mocks Supabase |
| lib (utils, preco, ean13) | 80% | Cálculos e decodificação |
| Hooks | 70% | Incluir useOffline* quando aplicável |
| Components (UI) | 50% | Happy path + estados de erro/empty |
| Global | 60% | Threshold no jest.config.js |

Ajustar thresholds em `jest.config.js` conforme acordo do time. CI pode falhar ou só reportar (ver skill ci-cd-qualidade).

## Mocks Comuns

### Supabase Mock

```typescript
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
    })),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-123', email: 'operador@padaria.com' } },
        error: null,
      }),
    },
  },
}))
```

### IndexedDB / offlineStorage Mock

```typescript
jest.mock('@/lib/offlineStorage', () => ({
  offlineStorage: {
    produtos: {
      get: jest.fn(),
      put: jest.fn(),
      getAll: jest.fn().mockResolvedValue([]),
    },
    vendas: {
      put: jest.fn(),
    },
    syncQueue: {
      enqueue: jest.fn(),
      getPendentes: jest.fn().mockResolvedValue([]),
    },
  },
}))
```

### Navigator Online Mock

```typescript
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true, // ou false para testar offline
})
```

## Checklist Detalhada de Cenários

### PDV / Vendas
- [ ] Venda com 1 item simples
- [ ] Venda com múltiplos itens
- [ ] Venda com código de balança (peso variável)
- [ ] Venda com cada forma de pagamento
- [ ] Venda com troco (dinheiro)
- [ ] Venda na caderneta (dentro do limite)
- [ ] Venda na caderneta (excede limite → deve bloquear)
- [ ] Venda offline → enfileirada para sync

### Caixa
- [ ] Abertura de caixa com valor inicial
- [ ] Fechamento com cálculo de diferença
- [ ] Não permitir venda com caixa fechado
- [ ] Sessão retomada após reload

### Estoque
- [ ] Dedução de estoque após venda
- [ ] Alerta de estoque mínimo
- [ ] Estoque não fica negativo

### Caderneta
- [ ] Criar cliente com limite
- [ ] Compra atualiza saldo devedor
- [ ] Pagamento reduz saldo devedor
- [ ] Limite respeitado
- [ ] Pagamento parcial

### Offline / Sync
- [ ] Dados salvos no IndexedDB quando offline
- [ ] Fila de sync preenchida corretamente
- [ ] Sync processa na reconexão
- [ ] Conflito resolvido (last write wins)
- [ ] Retry após falha de sync

### Cálculos
- [ ] Custo de receita (soma de insumos)
- [ ] Margem de lucro
- [ ] Preço de venda
- [ ] Decodificação EAN-13 balança
- [ ] Arredondamento de centavos

## Testes que este agente NÃO escreve

- **E2E** (Playwright, Cypress, browser real)
- **Testes de carga** (k6, Artillery, etc.)
- **Testes que exigem hardware** (impressora, leitor USB) — apenas mocks
- **Snapshot de UI** sem critério de comportamento — preferir testes de comportamento (Testing Library)

Se a tarefa pedir um desses, informar ao usuário que está fora do escopo atual e sugerir ferramenta ou agente.

## Paths de Import no Projeto

- Supabase client: `@/lib/supabase/client` ou `@/lib/supabase`
- offlineStorage: `@/lib/offlineStorage` (verificar path real no projeto)
- Types: `@/types/*`
- Services: `@/services/*`
- Repositories: `@/repositories/*`
- Hooks: `@/hooks/*`
- Fixtures: `tests/fixtures/*`
