# Documentação: Página de Leitor de Código de Barras

**Localização do Arquivo:** `src/app/codigo-barras/page.tsx`

## 1. Visão Geral

A `CodigoBarrasPage` é uma interface de Ponto de Venda (PDV) moderna, projetada para agilizar o processo de venda através da leitura de códigos de barras. Construída com Next.js e React, a página permite que o operador escaneie produtos usando a câmera do dispositivo ou digite o código manualmente, adicione-os a um carrinho de compras virtual e finalize a venda de forma rápida e intuitiva.

A página é totalmente funcional no lado do cliente, utilizando o estado do React para gerenciar o carrinho e o `localStorage` para persistir um histórico de vendas, tornando-a resiliente e rápida.

## 2. Funcionalidades Principais

### Leitura e Busca de Produtos
- **Leitura por Câmera:** Permite ativar a câmera do dispositivo (celular, tablet, webcam) para escanear códigos de barras em tempo real. Utiliza a API `navigator.mediaDevices.getUserMedia`.
- **Digitação Manual:** Um campo de texto otimizado permite que o operador digite o código de barras. A busca é acionada automaticamente à medida que o código é digitado, agilizando a localização do produto.
- **Busca Inteligente:** Ao buscar um código, o sistema primeiro verifica a lista de produtos já carregada no estado local. Se não encontrar, ele simula uma chamada a um serviço externo (`barcodeService`) para buscar o produto em uma base de dados mais ampla.

### Gestão do Carrinho de Compras
- **Adição de Itens:** Produtos encontrados (seja por câmera ou digitação) podem ser adicionados ao carrinho com um clique.
- **Atualização de Quantidade:** O operador pode facilmente aumentar ou diminuir a quantidade de cada item diretamente no carrinho. A remoção de um item é feita ao diminuir a quantidade para zero.
- **Remoção e Limpeza:** É possível remover itens individualmente ou limpar o carrinho inteiro com uma única ação.
- **Cálculo de Subtotal e Total:** O sistema calcula e exibe o subtotal de cada item e o valor total do carrinho em tempo real.

### Finalização de Venda
- **Processamento da Venda:** Ao clicar em "Finalizar Venda", o sistema executa as seguintes ações:
  1.  **Validação:** Verifica se o carrinho não está vazio.
  2.  **Atualização de Estoque (Simulada):** Atualiza o estado local do estoque dos produtos vendidos.
  3.  **Criação do Registro:** Gera um objeto `Venda` com ID, data, itens e valor total.
  4.  **Persistência Local:** Salva o registro da venda no `localStorage` do navegador, criando um histórico simples de transações.
  5.  **Limpeza:** Esvazia o carrinho para preparar para a próxima venda.

### Experiência do Usuário (UX)
- **Layout Responsivo:** A interface é dividida em duas colunas principais (painel de leitura e carrinho), adaptando-se bem a diferentes tamanhos de tela.
- **Feedback Visual:**
  - **Toasts:** Notificações são exibidas no canto da tela para informar o sucesso ou falha de operações, como "Venda finalizada com sucesso!" ou "O carrinho está vazio.".
  - **Status de Erro:** Mensagens de erro claras são exibidas caso um produto não seja encontrado.
  - **Produto Encontrado:** Um card dedicado exibe os detalhes do último produto escaneado/encontrado, facilitando a confirmação antes de adicionar ao carrinho.
- **Acesso Protegido:** A página é envolvida pelo componente `ProtectedLayout`, garantindo que apenas usuários autenticados possam acessá-la.

## 3. Estrutura e Lógica do Componente

### Hooks
- **`useState`:** Gerencia todo o estado da página, incluindo:
  - `produtos`: Lista de produtos disponíveis (simulada).
  - `carrinho`: Array de `ItemCarrinho` que representa a venda atual.
  - `loading` e `erro`: Para controle de feedback durante as buscas.
  - `codigoDigitado`: Valor do campo de input manual.
  - `produtoEncontrado`: Armazena o último produto localizado para exibição.
  - `cameraAtiva`: Controla a visibilidade e o estado do stream da câmera.
  - `toast`: Objeto que define o conteúdo e o tipo da notificação a ser exibida.

- **`useRef`:**
  - `videoRef`: Referência ao elemento `<video>` para exibir o stream da câmera.
  - `canvasRef`: Referência a um elemento `<canvas>` (oculto), usado para capturar um frame do vídeo para processamento (simulado).

- **`useEffect`:**
  - Utilizado para carregar a lista inicial de produtos simulados quando o componente é montado.

### Fluxo de Dados e Operações

1.  **Carregamento Inicial:**
    - O `useEffect` chama `carregarProdutos`, que simula uma chamada de API e popula o estado `produtos` com dados mocados.

2.  **Busca de Produto (`buscarProdutoPorCodigo`):**
    - O usuário digita um código ou um é capturado pela câmera.
    - A função primeiro busca o código no estado `produtos`.
    - Se não encontra, importa dinamicamente e chama um serviço simulado (`barcodeService.consultarProduto`).
    - Se o serviço retorna um produto, ele é adicionado ao estado `produtos` e definido como `produtoEncontrado`.
    - Caso contrário, uma mensagem de erro é exibida.

3.  **Adicionar ao Carrinho (`adicionarAoCarrinho`):**
    - Recebe um objeto `Produto`.
    - Verifica se o produto já existe no carrinho.
    - Se sim, incrementa a quantidade.
    - Se não, adiciona um novo `ItemCarrinho` ao estado `carrinho`.
    - Limpa os estados `codigoDigitado` e `produtoEncontrado`.

4.  **Finalizar Venda (`processarVenda`):**
    - Valida se o carrinho tem itens.
    - Mapeia os produtos no estado `produtos` e atualiza o estoque com base nos itens do `carrinho`.
    - Cria um objeto `Venda`.
    - Acessa o `localStorage`, recupera o histórico de vendas, adiciona a nova venda e salva de volta.
    - Limpa o estado `carrinho` e exibe um toast de sucesso.

## 4. Componentes e Dependências

- **`ProtectedLayout`:** Garante que a página seja privada e acessível apenas por usuários logados.
- **`Toast`:** Um componente local simples para exibir notificações de feedback.
- **`lucide-react`:** Biblioteca de ícones usada extensivamente na interface para melhorar a usabilidade.
- **`@/lib/services/barcodeService` (Simulado):** Um serviço mockado que simula a consulta de um código de barras em uma API externa.
- **`@/lib/services/databaseService` (Simulado):** Um serviço mockado que simula a gravação de um novo produto no banco de dados.

## 5. Pontos de Melhoria e Considerações

- **Integração Real com Scanner:** A lógica de captura de frame (`capturarFrame`) é uma simulação. Para produção, seria necessário integrar uma biblioteca de leitura de código de barras real, como `QuaggaJS` ou `@zxing/library`.
- **Persistência de Dados Real:** A lista de produtos, o estoque e o histórico de vendas são atualmente simulados ou salvos no `localStorage`. A próxima etapa seria integrar essas operações com um banco de dados real (via API), como o Supabase, para garantir a consistência e persistência dos dados.
- **Gerenciamento de Estado:** Para uma aplicação maior, o gerenciamento de estado com `useState` pode se tornar complexo. Adoção de bibliotecas como Zustand, Jotai ou Redux Toolkit poderia centralizar e simplificar a lógica do carrinho e dos produtos.
- **Componentização:** O componente `Toast` poderia ser movido para um diretório de componentes reutilizáveis (`/components/ui`) para ser usado em outras partes da aplicação.

<!--
[PROMPT_SUGGESTION]Integre a página de código de barras com o Supabase para carregar produtos reais e salvar as vendas no banco de dados.[/PROMPT_SUGGESTION]
[PROMPT_SUGGESTION]Implemente uma biblioteca real de scanner de código de barras, como a ZXing, na função `capturarFrame`.[/PROMPT_SUGGESTION]
