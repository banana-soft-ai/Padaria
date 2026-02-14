# Testes E2E (Supabase real)

Esta suíte roda contra um projeto Supabase real (sem mocks).

## Requisitos

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (recomendado) ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Como executar

```bash
npm run test:e2e
```

## Cenários atuais da base E2E

- `pdv-venda-completa.test.ts`: cria receita + produto vinculados.
- `caderneta-credito.test.ts`: cria cliente caderneta + movimentação.
- `caixa-abertura-fechamento.test.ts`: abre e fecha caixa diário.

Todos os cenários limpam os dados criados ao final do teste.
