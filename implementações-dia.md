# Implementações Pendentes - Banco de Dados (Tabela Vendas)

#permitir fechar caixa (só pra n esquecer)

Para corrigir o erro ao finalizar a venda e garantir que os relatórios financeiros funcionem corretamente, é necessário atualizar a estrutura da tabela `vendas` no Supabase amanhã.

## 1. Atualizar Tabela `vendas` (SQL)

Execute o seguinte script no **SQL Editor** do Supabase para adicionar as colunas de controle financeiro e ajustar o tipo do número da venda:

```sql
-- 0. Remover a view dependente antes de alterar a coluna
DROP VIEW IF EXISTS vendas_hoje;

-- 1. Adicionar colunas para registrar quanto foi pago, o débito (para caderneta) e o troco
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS valor_pago DECIMAL(10,2) DEFAULT 0;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS valor_debito DECIMAL(10,2) DEFAULT 0;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS valor_troco DECIMAL(10,2) DEFAULT 0;

-- 2. Alterar o tipo de numero_venda para BIGINT (para suportar o timestamp gerado no front)
ALTER TABLE vendas ALTER COLUMN numero_venda TYPE BIGINT;

-- 3. Recriar a view (Exemplo padrão, ajuste se tiver filtros específicos)
CREATE OR REPLACE VIEW vendas_hoje AS SELECT * FROM vendas WHERE data = CURRENT_DATE;
```

## 2. Checklist de Verificação

- [ ] Verificar se a tabela `vendas` possui as colunas `valor_pago`, `valor_debito` e `valor_troco`.
- [ ] Confirmar se o frontend (`src/app/caixa/page.tsx`) está enviando esses campos na função `finalizarVenda`.
- [ ] Testar uma venda em **Dinheiro** (verificar se `valor_pago` e `valor_troco` são salvos).
- [ ] Testar uma venda em **Caderneta** (verificar se `valor_debito` é salvo e `valor_pago` fica 0).

## 3. Lembrete de Código (Frontend)

Lembrar de atualizar a inserção no `page.tsx` para incluir os novos campos:

```typescript
valor_pago: valorPago,
valor_debito: valorDebito,
valor_troco: valorTroco,
```