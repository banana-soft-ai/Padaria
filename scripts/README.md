# Scripts SQL - Rey dos Pães

Este diretório contém scripts SQL essenciais para a manutenção e operação do banco de dados do sistema Rey dos Pães. Aqui você encontrará scripts para criar views, functions, triggers e realizar migrações de dados.

## Estrutura do Diretório

```
scripts/
└── views-uteis/
    └── views-uteis.sql
```

-   **views-uteis**: Contém a definição de `VIEWS` do PostgreSQL. As views são usadas para encapsular e simplificar consultas complexas, fornecendo "tabelas virtuais" que podem ser consultadas pela aplicação para gerar relatórios e visualizações de dados.

---

## Detalhes dos Scripts

### `/views-uteis/views-uteis.sql`

Este arquivo cria e gerencia as views utilizadas para relatórios e análises rápidas no sistema.

#### `vendas_hoje`

**Propósito:** Fornece um relatório consolidado de todas as vendas realizadas no dia corrente. É ideal para o acompanhamento diário das operações.

**Colunas:**
-   `id`: ID da venda.
-   `numero_venda`: Número de identificação da venda.
-   `hora`: Horário da venda.
-   `cliente_nome`: Nome do cliente associado (se houver).
-   `vendedor_nome`: Nome do vendedor que registrou a venda.
-   `valor_total`: Montante total da venda.
-   `forma_pagamento`: Método de pagamento (ex: 'dinheiro', 'pix').
-   `status`: Status da venda (ex: 'concluida').

#### `produtos_estoque_baixo`

**Propósito:** Identifica produtos que dependem de insumos com estoque baixo. A view verifica se algum dos ingredientes necessários para a receita de um produto atingiu ou está abaixo do seu nível de estoque mínimo.

**Lógica:** A view retorna um produto se pelo menos um de seus insumos (`insumos`) satisfaz a condição `estoque_atual <= estoque_minimo`.

**Colunas:**
-   `id`: ID do produto.
-   `nome`: Nome do produto.
-   `categoria`: Categoria do produto.
-   `preco_venda`: Preço de venda unitário.
-   `ingredientes_necessarios`: Campo calculado (atualmente `0`, a lógica principal está no `HAVING`).
-   `status`: Um texto fixo `'Verificar disponibilidade'` para sinalizar a necessidade de atenção.

As três views acima são criadas com **`security_invoker = true`** para que o RLS (Row Level Security) do usuário que consulta seja aplicado. Ver `docs/decisions/views-security-invoker.md`.

#### `resumo_caixa_hoje`

**Propósito:** Gera um resumo financeiro detalhado para o caixa que está aberto no dia corrente. Consolida os totais de vendas por forma de pagamento e o valor total movimentado.

**Lógica:** Filtra as vendas do dia (`CURRENT_DATE`) para o caixa com status `'aberto'` e agrupa os valores.

**Colunas:**
-   `caixa_id`: ID do caixa.
-   `data_abertura`: Data de abertura do caixa.
-   `valor_abertura`: Valor inicial no caixa.
-   `total_vendas`: Soma total das vendas registradas no caixa.
-   `vendas_dinheiro`, `vendas_debito`, `vendas_credito`, `vendas_pix`, `vendas_caderneta`: Total vendido em cada forma de pagamento.
-   `total_vendas_count`: Número total de transações de venda.

# COMO RODAR CADA SCRIPT 

## SCRIPTS EM BANCO DE DADOS 

**Lógica:** Feitos para rodar no Banco de Dados Supabase.
no SQL editor contendo só copiar o conteúdo do setup-database.sql que já contém todas as tabelas

## SCRIPTS EM BANCO DE DADOS