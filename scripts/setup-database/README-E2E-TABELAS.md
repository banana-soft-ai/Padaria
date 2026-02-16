# Como conferir se as tabelas do E2E existem no setup-database

Os testes E2E (`tests/e2e/*.test.ts`) usam o Supabase real. Eles precisam que as **tabelas e colunas** existam no banco criado por `setup-database.sql`.

## Passo a passo para você fazer essa verificação

### 1. Liste as tabelas que o E2E usa

Rode no projeto (PowerShell ou Git Bash):

```bash
rg "\.from\(['\"](\w+)['\"]" tests/e2e --only-matching -r '$1' | sort -u
```

Ou abra os arquivos em `tests/e2e/` e procure por `.from('nome_da_tabela')`. Anote cada nome.

### 2. Confira no SQL

Abra `scripts/setup-database/setup-database.sql` e procure por `CREATE TABLE`:

- Cada nome que o E2E usa deve existir **exatamente** como em `CREATE TABLE IF NOT EXISTS nome_da_tabela`.
- No Supabase/Postgres os nomes são case-sensitive em aspas; sem aspas são normalizados para minúsculo. O cliente JS usa minúsculo, então compare em minúsculo.

### 3. Mapeamento E2E ↔ setup-database.sql (fonte da verdade)

| Teste E2E usa (antigo/errado) | Nome correto no setup-database.sql |
|-------------------------------|-----------------------------------|
| `receitas_itens`              | **`receitas`**                    |
| `varejo_itens`                | **`varejo`**                     |
| `caderneta_clientes`          | **`clientes_caderneta`**         |
| `caderneta_movimentacoes`     | **`movimentacoes_caderneta`**    |
| `caixa_diario`                | `caixa_diario` ✓                 |
| `vendas`                      | `vendas` ✓                       |
| `venda_itens`                 | `venda_itens` ✓                  |

Ou seja: no SQL **não existem** `receitas_itens`, `varejo_itens`, `caderneta_clientes` nem `caderneta_movimentacoes`. Os nomes corretos são `receitas`, `varejo`, `clientes_caderneta` e `movimentacoes_caderneta`.

### 4. Colunas importantes

- **receitas**: o E2E pode inserir com `nome`, `preco_venda`, `ativo` (o SQL tem `preco_venda` via ALTER e defaults em `categoria`, `rendimento`, `ativo`).
- **varejo**: `nome`, `preco_venda`, `ativo`.
- **clientes_caderneta**: `nome`, `telefone`, `cpf_cnpj`, `limite_credito`, `saldo_devedor`, `ativo`, `observacoes`.
- **movimentacoes_caderneta**: `cliente_id`, `tipo`, `valor`, `saldo_anterior`, `saldo_atual`, etc.

Se o E2E usar um nome de coluna que não existe no SQL (ex.: `preco` em vez de `preco_venda`), o insert vai falhar.

### 5. Resumo

- As tabelas que o E2E precisa **existem** no seu `setup-database.sql`, mas com **nomes diferentes** em 4 casos.
- Os testes E2E foram ajustados para usar os nomes corretos: `receitas`, `varejo`, `clientes_caderneta`, `movimentacoes_caderneta`.
- Depois de rodar o `setup-database.sql` no seu projeto Supabase e de configurar RLS (ou usar usuário autenticado), os E2E devem conseguir rodar contra esse banco.
