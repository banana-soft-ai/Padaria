# Documentação: Página de Gestão da Caderneta

**Localização do Arquivo:** `src/app/caderneta/page.tsx`

## 1. Visão Geral

A `CadernetaPage` é o componente central para a gestão de crédito dos clientes (sistema de "fiado" ou caderneta). Construída com Next.js e React, a página oferece uma interface completa para criar, visualizar, atualizar e gerenciar clientes e suas transações financeiras.

Seu principal diferencial é a **capacidade de funcionar offline**. Todas as operações críticas, como adicionar clientes, registrar pagamentos e ajustar saldos, podem ser realizadas sem conexão com a internet. Os dados são armazenados localmente e sincronizados automaticamente com o banco de dados Supabase assim que a conexão é restabelecida.

## 2. Funcionalidades Principais

### Gestão de Clientes (CRUD)
- **Listagem e Pesquisa:** Exibe uma lista de todos os clientes ativos. Um campo de busca permite filtrar clientes por nome, telefone ou endereço em tempo real.
- **Cadastro de Novos Clientes:** Um modal permite adicionar novos clientes com informações essenciais como nome, telefone, endereço e limite de crédito.
- **Edição de Clientes:** Permite atualizar os dados de um cliente existente.
- **Desativação de Clientes:** Em vez de excluir, um cliente pode ser desativado. A operação só é permitida se o cliente não tiver saldo devedor, preservando o histórico de transações.

### Gestão Financeira
- **Registro de Pagamentos:** Permite registrar pagamentos parciais ou totais da dívida de um cliente.
  - **Validação de Caixa:** Antes de registrar um pagamento, o sistema verifica se o **caixa do dia correspondente está aberto**, prevenindo inconsistências financeiras.
- **Ajuste de Saldo:** Oferece uma funcionalidade para corrigir ou ajustar manualmente o saldo devedor de um cliente, gerando uma movimentação de "Ajuste" para fins de auditoria.

### Visualização de Dados
- **Painel do Cliente:** Cada cliente é exibido em um card com seu saldo devedor atual e limite de crédito.
- **Histórico de Movimentações:** Uma tabela detalhada exibe todas as transações (compras, pagamentos, ajustes) de todos os clientes, ordenadas cronologicamente. As movimentações são diferenciadas por cores para fácil identificação.

### Experiência do Usuário (UX)
- **Suporte Offline:** Um indicador visual (ícone `WifiOff`) informa ao usuário quando o sistema está operando em modo offline. As mensagens de feedback também refletem se a ação foi salva localmente ou sincronizada com o servidor.
- **Modais Interativos:** O uso de modais para formulários (novo cliente, pagamento, ajuste de saldo) mantém o usuário no contexto da página.
- **Confirmação de Ações:** Um modal de confirmação genérico é usado para ações destrutivas (como desativar um cliente), prevenindo ações acidentais.
- **Feedback com Toasts:** Notificações (Toasts) são exibidas para dar feedback imediato sobre o sucesso ou falha das operações.

## 3. Estrutura e Lógica do Componente

### Hooks
- **`useCadernetaOffline()`:** Este é o coração da página. É um hook customizado que abstrai toda a complexidade do gerenciamento de dados online e offline. Ele é responsável por:
  - Buscar e armazenar em cache os dados das tabelas `clientes_caderneta` e `movimentacoes_caderneta`.
  - Fornecer métodos para `adicionar`, `atualizar` e `remover` dados que funcionam tanto online quanto offline.
  - Sincronizar automaticamente as alterações locais com o banco de dados Supabase.
  - Expor o estado da conexão (`isOffline`) e o status de sincronização (`pendingSync`).

- **`useState`:** Utilizado para gerenciar o estado da interface, como:
  - Visibilidade dos modais (`showModalCliente`, `showModalPagamento`, etc.).
  - Dados dos formulários (`formCliente`, `formPagamento`, `formSaldo`).
  - Termo de pesquisa e a lista de clientes filtrados.
  - Conteúdo e visibilidade dos Toasts e do modal de confirmação.

### Fluxo de Dados e Operações

1.  **Carregamento Inicial:**
    - O hook `useCadernetaOffline` é inicializado e começa a carregar os dados de clientes e movimentações do cache local (IndexedDB) e, em seguida, tenta sincronizar com o Supabase.
    - A UI exibe um estado de `loading` enquanto os dados iniciais são preparados.

2.  **Adicionar/Editar Cliente (`handleSubmitCliente`):**
    - O formulário é preenchido no modal.
    - Ao submeter, os dados são passados para as funções `adicionarCliente` ou `atualizarCliente` do hook `useCadernetaOffline`.
    - O hook salva a alteração localmente e, se online, a envia para o Supabase.
    - A UI é atualizada reativamente com o novo estado dos dados.

3.  **Registrar Pagamento (`handleSubmitPagamento`):**
    - O formulário de pagamento é preenchido.
    - **Validação Crítica:** O sistema faz uma chamada direta ao Supabase para verificar se o `caixa_diario` da data do pagamento está com o status `aberto`.
      - Se o caixa estiver fechado, a operação é bloqueada e um erro é exibido.
      - Se estiver aberto, a operação continua.
    - A função `registrarPagamento` do hook é chamada. Ela atomicamente:
      - Cria uma nova `movimentacao_caderneta` do tipo `pagamento`.
      - Atualiza o `saldo_devedor` na tabela `clientes_caderneta`.
    - O hook gerencia o salvamento local e a sincronização.

4.  **Ajustar Saldo (`handleSubmitSaldo`):**
    - O usuário informa o novo saldo desejado.
    - O sistema calcula a diferença em relação ao saldo atual.
    - A função `adicionarMovimentacao` do hook é chamada para criar uma transação que representa o ajuste (seja como 'compra' para aumentar a dívida ou 'pagamento' para diminuir).
    - O saldo do cliente é atualizado atomicamente pelo hook.

## 4. Componentes Externos e Dependências

- **`ProtectedLayout`:** Garante que a página só possa ser acessada por usuários autenticados.
- **`Toast`:** Componente reutilizável para exibir notificações.
- **`lucide-react`:** Biblioteca de ícones utilizada em toda a interface.
- **`@/lib/supabase`:** Contém a instância do cliente Supabase e as definições de tipos (interfaces) do banco de dados.
- **`@/hooks/useCadernetaOffline`:** Hook customizado para gerenciamento de dados com suporte offline.

## 5. Pontos de Melhoria e Considerações

- **Paginação no Histórico:** O histórico de movimentações pode se tornar muito grande. Implementar paginação (seja no cliente ou no servidor) melhoraria a performance.
- **Relatórios:** Adicionar a capacidade de gerar relatórios em PDF ou CSV do extrato de um cliente.
- **Validação de Formulários:** A validação pode ser aprimorada com bibliotecas como `zod` ou `react-hook-form` para fornecer feedback mais robusto ao usuário.
- **Otimização da Validação de Caixa:** A verificação do status do caixa é a única operação que depende de conexão no fluxo de pagamento. Em um cenário 100% offline, poderia ser considerado armazenar o status do caixa do dia localmente, embora isso adicione complexidade à sincronização.