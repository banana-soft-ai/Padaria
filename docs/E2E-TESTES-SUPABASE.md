# Testes E2E contra Supabase – O que está acontecendo e por que (ainda) podem falhar

Este documento descreve o que os testes E2E fazem, o que já foi ajustado e por que um deles pode continuar falhando em alguns cenários.

---

## 1. O que são os testes E2E

Os testes em `tests/e2e/` **não são mocks**: eles usam um **cliente Supabase real** e um **banco Supabase real** (o mesmo que você configura em `.env.local`). Eles:

- Criam dados (receitas, varejo, produtos, clientes caderneta, caixa, vendas).
- Fazem inserts/updates/deletes via `@supabase/supabase-js`.
- Validam regras de negócio e fluxos (abertura/fechamento de caixa, PDV, caderneta).

Arquivos:

| Arquivo | O que testa |
|--------|---------------|
| `pdv-venda-completa.test.ts` | PDV: receitas, varejo, caixa, vendas, itens (produto_id/varejo_id). |
| `caderneta-credito.test.ts` | Caderneta: clientes_caderneta, movimentacoes_caderneta, vendas a prazo. |
| `caixa-abertura-fechamento.test.ts` | Caixa: abrir, registrar vendas, fechar, conferir totais e diferenças. |

---

## 2. O que já foi corrigido (resumo)

- **Credenciais e env**  
  - Jest não carrega `.env.local` por padrão.  
  - **Ajuste:** em `jest.setup.js` passamos a carregar `.env.local` com `dotenv` (e `quiet: true`).

- **`fetch is not defined`**  
  - Em ambiente `jsdom` não existe `fetch`; o cliente Supabase precisa dele.  
  - **Ajuste:** quando a suíte de testes inclui `e2e`, o Jest usa `testEnvironment: 'node'` (ver `jest.config.js`), onde o Node já oferece `fetch`.

- **RLS (Row Level Security)**  
  - As políticas do `setup-database.sql` permitem apenas `auth.role() = 'authenticated'`. Os testes rodavam com a chave **anon**, então todos os inserts falhavam com “new row violates row-level security policy”.  
  - **Ajuste:** nos E2E o cliente Supabase passou a usar `SUPABASE_SERVICE_ROLE_KEY` quando existir (fallback para `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Com service role, o RLS é contornado e os inserts funcionam.

- **Nomes de tabelas**  
  - Os testes usavam nomes que não existem no seu schema (`receitas_itens`, `varejo_itens`, `caderneta_clientes`, `caderneta_movimentacoes`).  
  - **Ajuste:** alinhamento com o `setup-database.sql`: `receitas`, `varejo`, `clientes_caderneta`, `movimentacoes_caderneta`. Colunas ajustadas (ex.: `preco_venda` em vez de `preco`).

- **`numero_venda` em vendas**  
  - A tabela `vendas` exige `numero_venda` NOT NULL; o mock de insert não enviava.  
  - **Ajuste:** em `criarVendaInsertMock` (fixtures) foi adicionado `numero_venda: 900001` no objeto base.

- **Coluna `item_id` em `venda_itens`**  
  - O banco tem `produto_id` e `varejo_id`, não `item_id` nem `tipo`. O PostgREST retornava “Could not find the 'item_id' column”.  
  - **Ajuste:** no PDV E2E, os itens de venda passaram a ser inseridos com `produto_id` / `varejo_id`; e no setup do PDV é criado um **produto** ligado à receita para usar em `venda_itens`.

- **Isolamento entre suites (caixa aberto)**  
  - O primeiro teste de `caixa-abertura-fechamento` espera “nenhum caixa aberto no dia”. Caixas abertos criados por outros arquivos E2E (caderneta, PDV) ou por rodadas anteriores permaneciam no banco e faziam o teste falhar.  
  - **Ajustes:**  
    - `jest.config.js`: para E2E, `maxWorkers: 1` (suites rodam em série).  
    - `beforeEach` do caixa: limpeza de caixas de teste (por observação “TESTE E2E” / “Abertura teste”) **respeitando FKs**: antes de apagar `caixa_diario`, são apagados `vendas`, `caixa_movimentacoes`, `fluxo_caixa`, `turno_operador`.  
    - No primeiro teste (“deve abrir caixa, registrar vendas e fechar com totais corretos”): **limpeza explícita** logo no início – busca todos os caixas abertos do dia, apaga dependentes (vendas, caixa_movimentacoes, fluxo_caixa, turno_operador) e depois os caixas; em seguida faz o `select` e a asserção `expect(caixasAbertos ?? []).toEqual([])`.

---

## 3. Por que o E2E do caixa-abertura ainda pode falhar

Mesmo com as correções acima, o primeiro teste de `caixa-abertura-fechamento` pode continuar falhando nos seguintes casos.

### 3.1 Resquícios de rodadas anteriores

- Os E2E **não** rodam contra um banco “zerado” a cada execução.  
- Se em uma rodada anterior (ou em outro lugar) foram criados caixas abertos para a **mesma data** (ex.: “hoje” no fuso do ambiente), eles continuam no banco.  
- A limpeza no início do primeiro teste remove **todos** os caixas abertos do dia (e dependentes). Se essa limpeza falhar por algum motivo (ex.: outra FK não tratada, timeout, erro de rede), a asserção “lista de caixas abertos vazia” falha.

### 3.2 Ordem de execução das suites

- Com `maxWorkers: 1`, a ordem é determinística (por nome do arquivo):  
  `caderneta-credito` → `caixa-abertura-fechamento` → `pdv-venda-completa`.  
- Se o **caderneta** criar caixas e, por algum bug, não removê-los no `afterEach` (ex.: falha ao apagar por FK), o **caixa-abertura** pode ver esses caixas no “hoje”.  
- A limpeza explícita no primeiro teste do caixa foi feita justamente para não depender só do `beforeEach` e da ordem: ela apaga **todos** os abertos do dia antes de afirmar que a lista está vazia.

### 3.3 Falha na limpeza (FK ou RLS)

- Para apagar `caixa_diario`, é necessário apagar antes:  
  `vendas`, `caixa_movimentacoes`, `fluxo_caixa`, `turno_operador`.  
- Se no seu projeto existir **outra tabela** com FK para `caixa_diario` e ela não for limpa, o `delete` em `caixa_diario` pode falhar. Nesse caso, a limpeza não conclui e a asserção continua vendo caixas abertos.  
- Com **service role** não há RLS bloqueando; com **anon** a limpeza (e os próprios testes) tendem a falhar por RLS.

### 3.4 Data “hoje” e fuso horário

- A data usada é `new Date().toISOString().split('T')[0]` (data em UTC).  
- Se o servidor Supabase ou o ambiente de teste usarem outro fuso, “hoje” pode divergir e a query `.eq('data', dataHoje)` pode não retornar (ou não apagar) os mesmos registros que você espera.

---

## 4. Requisitos para os E2E passarem

- **Variáveis de ambiente** (em `.env.local`, carregadas pelo Jest via `jest.setup.js`):  
  - `NEXT_PUBLIC_SUPABASE_URL`  
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
  - `SUPABASE_SERVICE_ROLE_KEY` (recomendado para E2E, para contornar RLS)

- **Banco:**  
  - Schema aplicado (ex.: `scripts/setup-database/setup-database.sql`).  
  - Tabelas e colunas alinhadas com o que os testes usam (ver `scripts/setup-database/README-E2E-TABELAS.md`).

- **Isolamento (recomendado):**  
  - Usar um **projeto Supabase de teste** (ou um schema/database separado) para E2E, para não depender de limpar dados de produção e para evitar conflito com outros usos do mesmo banco.

---

## 5. Como rodar e conferir

```bash
npm test -- tests/e2e --testTimeout=30000
```

- Se **todos passarem**: as correções de env, RLS, tabelas, FKs e limpeza estão suficientes no seu ambiente.  
- Se **só o primeiro teste de caixa-abertura falhar**:  
  - Confira se a limpeza no início desse teste está rodando e se não há erro nos deletes (outras FKs, timeouts).  
  - Confira se a data “hoje” e o fuso estão consistentes.  
  - Considere rodar os E2E em um banco/schema dedicado a testes.

---

## 6. Referências no código

- **Config e env:** `jest.config.js` (E2E → node, maxWorkers 1), `jest.setup.js` (dotenv `.env.local`, polyfills).  
- **Chave Supabase nos E2E:** nos três arquivos em `tests/e2e/`, `supabaseKey` usa `SUPABASE_SERVICE_ROLE_KEY` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`.  
- **Limpeza do caixa:** `tests/e2e/caixa-abertura-fechamento.test.ts` – `beforeEach` (por observação) e início do primeiro teste (todos os abertos do dia + FKs: vendas, caixa_movimentacoes, fluxo_caixa, turno_operador).  
- **Tabelas e colunas:** `scripts/setup-database/README-E2E-TABELAS.md`.
