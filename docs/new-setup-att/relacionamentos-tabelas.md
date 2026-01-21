# 📄 Documentação do Banco de Dados - Rey dos Pães

Este documento fornece uma visão técnica detalhada da estrutura do banco de dados PostgreSQL para o sistema de gestão da padaria Rey dos Pães, com base no script `setup-database.sql`.

## 🏛️ Arquitetura Geral

O banco de dados foi projetado para ser robusto e escalável, cobrindo os principais fluxos operacionais de uma padaria, desde o controle de estoque e produção até o ponto de venda e a gestão financeira.

### Princípios de Design:
*   **Normalização:** A estrutura busca evitar a redundância de dados.
*   **Integridade:** Uso de chaves primárias, estrangeiras e constraints `CHECK` para garantir a consistência dos dados.
*   **Auditoria:** Colunas `created_at` e `updated_at` para rastreabilidade, além de tabelas de log específicas.
*   **Segurança:** Implementação de Row Level Security (RLS) para controle de acesso granular.
*   **Performance:** Criação de índices em colunas frequentemente consultadas para otimizar as queries.

### Extensões Utilizadas
*   `uuid-ossp`: Para geração de identificadores únicos universais (UUIDs), utilizados na tabela `usuarios`.

---

## 🗂️ Dicionário de Dados

A seguir, a descrição detalhada de cada tabela do sistema.

### 1. `usuarios`
Armazena os dados dos operadores do sistema para autenticação e controle de permissões.

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Chave primária (PK). | `PRIMARY KEY`, `DEFAULT uuid_generate_v4()` |
| `email` | `TEXT` | Email único para login. | `UNIQUE`, `NOT NULL` |
| `nome` | `TEXT` | Nome do usuário. | `NOT NULL` |
| `role` | `TEXT` | Nível de acesso do usuário. | `CHECK ('admin', 'gerente', 'funcionario', 'caixa')` |
| `ativo` | `BOOLEAN` | Indica se o usuário está ativo. | `DEFAULT true` |
| `created_at` | `TIMESTAMPTZ` | Data/hora de criação. | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Data/hora da última atualização. | `DEFAULT NOW()` |

### 2. `insumos`
Catálogo de ingredientes, embalagens e outros materiais.

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | Chave primária (PK). | `PRIMARY KEY` |
| `nome` | `TEXT` | Nome do insumo. | `NOT NULL` |
| `categoria` | `TEXT` | Tipo de insumo. | `CHECK ('insumo', 'embalagem', 'outro')` |
| `marca` | `TEXT` | Marca do insumo. | |
| `fornecedor` | `TEXT` | Fornecedor do insumo. | |
| `unidade` | `TEXT` | Unidade de medida padrão. | `NOT NULL`, `DEFAULT 'kg'` |
| `peso_pacote` | `DECIMAL(10,3)` | Peso do pacote de compra. | |
| `preco_pacote`| `DECIMAL(10,2)` | Preço do pacote de compra. | |
| `estoque_atual`| `DECIMAL(10,3)` | Quantidade em estoque. | `DEFAULT 0` |
| `estoque_minimo`| `DECIMAL(10,3)` | Nível mínimo para alerta. | `DEFAULT 0` |
| `created_at` | `TIMESTAMPTZ` | Data/hora de criação. | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Data/hora da última atualização. | `DEFAULT NOW()` |

### 3. `receitas`
Define as receitas dos produtos de fabricação própria.

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | Chave primária (PK). | `PRIMARY KEY` |
| `nome` | `TEXT` | Nome da receita. | `NOT NULL` |
| `categoria` | `TEXT` | Categoria da receita. | `CHECK ('pao', 'doce', 'salgado', ...)` |
| `rendimento` | `INTEGER` | Quantidade que a receita produz. | `NOT NULL`, `DEFAULT 1` |
| `unidade_rendimento` | `TEXT` | Unidade do rendimento. | `CHECK ('un', 'kg', 'g', ...)` |
| `tempo_preparo`| `INTEGER` | Tempo de preparo em minutos. | |
| `instrucoes` | `TEXT` | Modo de preparo. | |
| `observacoes` | `TEXT` | Notas adicionais. | |
| `ativo` | `BOOLEAN` | Indica se a receita está ativa. | `DEFAULT true` |
| `created_at` | `TIMESTAMPTZ` | Data/hora de criação. | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Data/hora da última atualização. | `DEFAULT NOW()` |

### 4. `receita_ingredientes`
Tabela de junção que lista os ingredientes de cada receita.

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | Chave primária (PK). | `PRIMARY KEY` |
| `receita_id` | `INTEGER` | FK para `receitas(id)`. | `ON DELETE CASCADE` |
| `insumo_id` | `INTEGER` | FK para `insumos(id)`. | `ON DELETE CASCADE` |
| `quantidade` | `DECIMAL(10,3)` | Quantidade do insumo na receita. | `NOT NULL` |
| `unidade` | `TEXT` | Unidade de medida do insumo. | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | Data/hora de criação. | `DEFAULT NOW()` |
> **Constraint:** `UNIQUE(receita_id, insumo_id)` para evitar duplicidade.

### 5. `produtos`
Catálogo de produtos finais disponíveis para venda.

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | Chave primária (PK). | `PRIMARY KEY` |
| `nome` | `TEXT` | Nome do produto. | `NOT NULL` |
| `categoria` | `TEXT` | Categoria do produto. | `CHECK ('pao', 'doce', ...)` |
| `receita_id` | `INTEGER` | FK para `receitas(id)` (opcional). | |
| `preco_venda` | `DECIMAL(10,2)` | Preço de venda ao consumidor. | `NOT NULL` |
| `peso_unitario`| `DECIMAL(10,3)` | Peso unitário em kg. | |
| `codigo_barras`| `TEXT` | Código de barras do produto. | `UNIQUE` |
| `ativo` | `BOOLEAN` | Indica se o produto está ativo. | `DEFAULT true` |
| `created_at` | `TIMESTAMPTZ` | Data/hora de criação. | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Data/hora da última atualização. | `DEFAULT NOW()` |

### 6. `clientes`
Cadastro de clientes da padaria.

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | Chave primária (PK). | `PRIMARY KEY` |
| `nome` | `TEXT` | Nome do cliente. | `NOT NULL` |
| `telefone` | `TEXT` | Telefone de contato. | |
| `email` | `TEXT` | Email do cliente. | |
| `endereco` | `TEXT` | Endereço do cliente. | |
| `cpf_cnpj` | `TEXT` | CPF ou CNPJ do cliente. | |
| `observacoes` | `TEXT` | Notas adicionais. | |
| `ativo` | `BOOLEAN` | Indica se o cliente está ativo. | `DEFAULT true` |
| `created_at` | `TIMESTAMPTZ` | Data/hora de criação. | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Data/hora da última atualização. | `DEFAULT NOW()` |

### 7. `caixas`
Controle de sessão de caixa (abertura e fechamento).

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | Chave primária (PK). | `PRIMARY KEY` |
| `usuario_id` | `UUID` | FK para `usuarios(id)`. | |
| `data_abertura`| `DATE` | Data de abertura do caixa. | `DEFAULT CURRENT_DATE` |
| `hora_abertura`| `TIME` | Hora de abertura. | `DEFAULT CURRENT_TIME` |
| `valor_abertura`| `DECIMAL(10,2)`| Valor inicial (suprimento). | `NOT NULL`, `DEFAULT 0` |
| `data_fechamento`| `DATE` | Data de fechamento. | |
| `hora_fechamento`| `TIME` | Hora de fechamento. | |
| `valor_fechamento`| `DECIMAL(10,2)`| Valor final apurado. | |
| `status` | `TEXT` | Status do caixa. | `CHECK ('aberto', 'fechado')` |
| `observacoes` | `TEXT` | Notas adicionais. | |
| `created_at` | `TIMESTAMPTZ` | Data/hora de criação. | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Data/hora da última atualização. | `DEFAULT NOW()` |

### 8. `vendas`
Registra cada transação de venda.

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | Chave primária (PK). | `PRIMARY KEY` |
| `numero_venda` | `INTEGER` | Número sequencial da venda no dia. | `NOT NULL` |
| `data` | `DATE` | Data da venda. | `DEFAULT CURRENT_DATE` |
| `hora` | `TIME` | Hora da venda. | `DEFAULT CURRENT_TIME` |
| `cliente_id` | `INTEGER` | FK para `clientes(id)` (opcional). | |
| `usuario_id` | `UUID` | FK para `usuarios(id)`. | |
| `caixa_id` | `INTEGER` | FK para `caixas(id)`. | |
| `valor_total` | `DECIMAL(10,2)`| Valor total da venda. | `NOT NULL`, `DEFAULT 0` |
| `desconto` | `DECIMAL(10,2)`| Valor do desconto. | `DEFAULT 0` |
| `forma_pagamento`| `TEXT` | Forma de pagamento utilizada. | `CHECK ('dinheiro', 'pix', ...)` |
| `status` | `TEXT` | Status da venda. | `CHECK ('pendente', 'finalizada', ...)` |
| `observacoes` | `TEXT` | Notas adicionais. | |
| `created_at` | `TIMESTAMPTZ` | Data/hora de criação. | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Data/hora da última atualização. | `DEFAULT NOW()` |

### 9. `venda_itens`
Detalha os produtos vendidos em cada transação.

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | Chave primária (PK). | `PRIMARY KEY` |
| `venda_id` | `INTEGER` | FK para `vendas(id)`. | `ON DELETE CASCADE` |
| `produto_id` | `INTEGER` | FK para `produtos(id)`. | |
| `quantidade` | `DECIMAL(10,3)`| Quantidade vendida. | `NOT NULL` |
| `preco_unitario`| `DECIMAL(10,2)`| Preço no momento da venda. | `NOT NULL` |
| `subtotal` | `DECIMAL(10,2)`| `quantidade` * `preco_unitario`. | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | Data/hora de criação. | `DEFAULT NOW()` |

### 10. `caderneta`
Controla o "fiado" dos clientes, registrando compras e pagamentos.

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | Chave primária (PK). | `PRIMARY KEY` |
| `cliente_id` | `INTEGER` | FK para `clientes(id)`. | `ON DELETE CASCADE` |
| `venda_id` | `INTEGER` | FK para `vendas(id)` (se for compra). | |
| `tipo_operacao`| `TEXT` | Tipo de lançamento. | `CHECK ('compra', 'pagamento')` |
| `valor` | `DECIMAL(10,2)`| Valor da operação. | `NOT NULL` |
| `saldo_anterior`| `DECIMAL(10,2)`| Saldo antes da operação. | `NOT NULL`, `DEFAULT 0` |
| `saldo_atual` | `DECIMAL(10,2)`| Saldo após a operação. | `NOT NULL` |
| `observacoes` | `TEXT` | Notas adicionais. | |
| `data_operacao`| `DATE` | Data da operação. | `DEFAULT CURRENT_DATE` |
| `hora_operacao`| `TIME` | Hora da operação. | `DEFAULT CURRENT_TIME` |
| `usuario_id` | `UUID` | FK para `usuarios(id)`. | |
| `created_at` | `TIMESTAMPTZ` | Data/hora de criação. | `DEFAULT NOW()` |

### 11. `estoque_movimentacoes`
Log detalhado de todas as alterações no estoque de insumos. Essencial para auditoria.

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | Chave primária (PK). | `PRIMARY KEY` |
| `insumo_id` | `INTEGER` | FK para `insumos(id)`. | `ON DELETE CASCADE` |
| `tipo_movimentacao`| `TEXT` | Causa da movimentação. | `CHECK ('entrada', 'saida', 'ajuste')` |
| `quantidade` | `DECIMAL(10,3)`| Quantidade movimentada. | `NOT NULL` |
| `quantidade_anterior`| `DECIMAL(10,3)`| Estoque antes da movimentação. | `NOT NULL` |
| `quantidade_atual`| `DECIMAL(10,3)`| Estoque após a movimentação. | `NOT NULL` |
| `motivo` | `TEXT` | Descrição do motivo. | |
| `referencia_id`| `INTEGER` | ID da origem (venda, receita, etc.). | |
| `referencia_tipo`| `TEXT` | Tipo da origem ('venda', 'receita'). | |
| `usuario_id` | `UUID` | FK para `usuarios(id)`. | |
| `data_movimentacao`| `DATE` | Data da movimentação. | `DEFAULT CURRENT_DATE` |
| `hora_movimentacao`| `TIME` | Hora da movimentação. | `DEFAULT CURRENT_TIME` |
| `created_at` | `TIMESTAMPTZ` | Data/hora de criação. | `DEFAULT NOW()` |

### 12. `custos_fixos`
Armazena despesas recorrentes da empresa (aluguel, salários, etc.).

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | Chave primária (PK). | `PRIMARY KEY` |
| `nome` | `TEXT` | Nome/Descrição do custo. | `NOT NULL` |
| `categoria` | `TEXT` | Categoria do custo. | `CHECK ('aluguel', 'energia', ...)` |
| `valor_mensal` | `DECIMAL(10,2)`| Valor mensal do custo. | `NOT NULL` |
| `data_vencimento`| `INTEGER` | Dia do vencimento (1-31). | `CHECK (>= 1 AND <= 31)` |
| `ativo` | `BOOLEAN` | Indica se o custo é recorrente. | `DEFAULT true` |
| `observacoes` | `TEXT` | Notas adicionais. | |
| `created_at` | `TIMESTAMPTZ` | Data/hora de criação. | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Data/hora da última atualização. | `DEFAULT NOW()` |

### 13. `lancamentos_fiscais`
Armazena informações de documentos fiscais (NF-e, NFC-e).

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | Chave primária (PK). | `PRIMARY KEY` |
| `tipo` | `TEXT` | Tipo de documento. | `CHECK ('nfe', 'nfce', 'cfop')` |
| `numero` | `TEXT` | Número do documento. | |
| `serie` | `TEXT` | Série do documento. | |
| `chave_acesso` | `TEXT` | Chave de acesso do documento. | |
| `valor_total` | `DECIMAL(10,2)`| Valor total do documento. | `NOT NULL` |
| `data_emissao` | `DATE` | Data de emissão. | `NOT NULL` |
| `status` | `TEXT` | Status do documento. | `CHECK ('pendente', 'processada', ...)` |
| `xml_content` | `TEXT` | Conteúdo do XML. | |
| `created_at` | `TIMESTAMPTZ` | Data/hora de criação. | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Data/hora da última atualização. | `DEFAULT NOW()` |

### 14. `logs_sistema`
Tabela de auditoria para registrar ações importantes no sistema.

| Coluna | Tipo | Descrição | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | Chave primária (PK). | `PRIMARY KEY` |
| `usuario_id` | `UUID` | FK para `usuarios(id)`. | |
| `acao` | `TEXT` | Ação realizada (ex: 'INSERT', 'UPDATE'). | `NOT NULL` |
| `tabela_afetada`| `TEXT` | Nome da tabela modificada. | |
| `registro_id` | `INTEGER` | ID do registro modificado. | |
| `dados_anteriores`| `JSONB` | Estado do registro antes da ação. | |
| `dados_novos` | `JSONB` | Estado do registro após a ação. | |
| `ip_address` | `INET` | Endereço IP do usuário. | |
| `user_agent` | `TEXT` | Navegador/cliente do usuário. | |
| `created_at` | `TIMESTAMPTZ` | Data/hora do log. | `DEFAULT NOW()` |

### Tabelas Adicionais / Para Refatoração
O script SQL inclui tabelas adicionais que parecem ser de uma versão anterior ou para refatoração futura. Elas podem ter sobreposição de funcionalidade com as tabelas principais.

*   `clientes_caderneta`: Funcionalidade similar a `clientes` e `caderneta`.
*   `movimentacoes_caderneta`: Funcionalidade similar a `caderneta`.
*   `caixa_diario`: Funcionalidade similar a `caixas`.
*   `fluxo_caixa`: Tabela para consolidar entradas e saídas.
*   `precos_venda`: Poderia ser usada para historiar preços dos `produtos`.
*   `composicao_receitas`: Funcionalidade idêntica a `receita_ingredientes`.

---

## ⚙️ Lógica de Negócio no Banco (Triggers e Funções)

### 1. `update_updated_at_column()`
*   **Tipo:** Função de Trigger.
*   **Descrição:** Atualiza automaticamente a coluna `updated_at` para a data e hora atuais (`NOW()`) sempre que um registro é modificado.
*   **Tabelas Associadas:** `usuarios`, `insumos`, `receitas`, `produtos`, `clientes`, `caixas`, `vendas`, `custos_fixos`, `lancamentos_fiscais`, `composicao_receitas`.

### 2. `atualizar_estoque_venda()`
*   **Tipo:** Função de Trigger.
*   **Descrição:** Disparada após a inserção de um item em `venda_itens`. Ela calcula os insumos necessários com base na receita do produto vendido, subtrai a quantidade do estoque de `insumos` e registra a saída em `estoque_movimentacoes`.
*   **Tabela Associada:** `venda_itens` (no evento `AFTER INSERT`).

### 3. Funções Utilitárias
*   `get_saldo_caderneta(cliente_id)`: Calcula e retorna o saldo devedor atual de um cliente com base nos registros da tabela `caderneta`.
*   `get_proximo_numero_venda()`: Retorna o próximo número de venda sequencial para o dia corrente.

---

## ⚡ Views (Visões)

Views são "tabelas virtuais" baseadas no resultado de uma query, usadas para simplificar consultas complexas e recorrentes.

### 1. `vendas_hoje`
*   **Descrição:** Fornece um relatório simplificado de todas as vendas realizadas no dia atual, juntando informações de `vendas`, `clientes` e `usuarios`.

### 2. `produtos_estoque_baixo`
*   **Descrição:** Lista os produtos cujos insumos necessários para sua produção estão com o estoque atual abaixo do estoque mínimo definido.
> **Nota:** A lógica desta view parece complexa e pode precisar de revisão para garantir a precisão no cálculo de disponibilidade.

### 3. `resumo_caixa_hoje`
*   **Descrição:** Apresenta um resumo do caixa que está aberto no dia atual, totalizando as vendas por forma de pagamento.

---

## 🔒 Segurança (Row Level Security - RLS)

O script habilita o RLS em todas as tabelas e aplica políticas de segurança.

*   **Estratégia Principal:** A política padrão permite que qualquer usuário autenticado (`auth.role() = 'authenticated'`) realize todas as operações (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) na maioria das tabelas.
*   **Observação:** Esta é uma configuração de RLS permissiva. Para um ambiente de produção, recomenda-se a criação de políticas mais granulares, baseadas na `role` do usuário armazenada na tabela `usuarios` (ex: 'admin', 'caixa'), para restringir o acesso a dados e operações sensíveis.

