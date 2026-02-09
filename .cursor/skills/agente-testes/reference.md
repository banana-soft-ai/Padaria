# Referência — Agente de Testes Rey dos Pães

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

## Paths de Import no Projeto

- Supabase client: `@/lib/supabase/client` ou `@/lib/supabase`
- offlineStorage: `@/lib/offlineStorage` (verificar path real no projeto)
- Types: `@/types/*`
- Services: `@/services/*`
- Repositories: `@/repositories/*`
- Hooks: `@/hooks/*`
