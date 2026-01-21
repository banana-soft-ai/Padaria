# Documentação: Página de Configurações (`/configuracoes`)

Este documento explica o funcionamento do arquivo `page.tsx` localizado na pasta `src/app/configuracoes`.

## 🎯 Qual é o objetivo do arquivo?

O objetivo deste arquivo é criar a página de **Configurações** do sistema. É uma área onde o usuário logado pode visualizar as informações da sua própria conta, verificar o status do sistema e, o mais importante, sair da sua sessão de forma segura (fazer logout).

---

## ✨ Principais Funcionalidades

1.  **Exibir Informações do Usuário**: Mostra dados do usuário que está logado, como e-mail, ID e a data do último acesso.
2.  **Segurança e Logout**: Oferece um botão para o usuário encerrar sua sessão (logout) e o redireciona para a tela de login.
3.  **Status do Sistema**: Apresenta informações estáticas sobre a conexão com o banco de dados e a versão do software.
4.  **Layout Protegido**: A página só pode ser acessada por usuários que já fizeram login, garantindo a segurança dos dados.

---

## ⚙️ Como o Código Funciona (Explicação)

Vamos analisar as partes mais importantes do código de forma simples.

### 1. Importações

No início do arquivo, importamos algumas ferramentas:

-   `useEffect` e `useState` do React: São "Hooks" do React.
    -   `useState`: Usado para criar "estados", que são como caixinhas para guardar informações que podem mudar (ex: dados do usuário, estado de carregamento).
    -   `useEffect`: Permite executar uma ação assim que a página é carregada, como buscar os dados do usuário.
-   `supabase`: Nosso conector com o banco de dados Supabase. É por meio dele que conversamos com o backend.
-   `ProtectedLayout`: Um componente que "envolve" nossa página para garantir que apenas usuários autenticados possam vê-la.
-   `lucide-react`: Uma biblioteca de ícones para deixar a interface mais bonita e intuitiva.

### 2. O Componente `ConfiguracoesPage`

Esta é a função principal que define tudo o que a página vai ter e fazer.

```typescriptreact
export default function ConfiguracoesPage() {
  // ... todo o código da página fica aqui dentro
}
```

### 3. Estados da Página (`useState`)

Temos dois estados principais:

```typescriptreact
const [loading, setLoading] = useState(true);
const [user, setUser] = useState</* ... */> (null);
```

-   `loading`: É uma "bandeira" que começa como `true`. Enquanto ela for `true`, a página mostra uma animação de carregamento. Quando os dados do usuário chegam, nós a mudamos para `false`.
-   `user`: É uma "caixinha" que começa vazia (`null`) e que vai guardar as informações do usuário depois que elas forem buscadas no Supabase.

### 4. Carregando os Dados do Usuário (`useEffect` e `carregarUsuario`)

Assim que a página carrega, o `useEffect` entra em ação e chama a função `carregarUsuario`.

```typescriptreact
useEffect(() => {
  carregarUsuario();
}, []);

const carregarUsuario = async () => {
  // ...
  const { data: { user } } = await supabase.auth.getUser();
  setUser(user);
  setLoading(false);
  // ...
};
```

-   A função `carregarUsuario` usa o `supabase.auth.getUser()` para perguntar ao Supabase: "Ei, quem é o usuário que está logado agora?".
-   Quando o Supabase responde, guardamos os dados na "caixinha" `user` usando `setUser(user)`.
-   Logo em seguida, mudamos a "bandeira" `loading` para `false` para esconder a animação de carregamento e mostrar o conteúdo da página.

### 5. Saindo do Sistema (`handleLogout`)

Esta função é acionada quando o usuário clica no botão "Fazer Logout".

```typescriptreact
const handleLogout = async () => {
  await supabase.auth.signOut(); // Avisa ao Supabase para encerrar a sessão
  window.location.href = '/login'; // Redireciona o usuário para a página de login
};
```

### 6. O que é Renderizado na Tela (JSX)

O `return` da função contém o HTML (com superpoderes, chamado JSX) que desenha a página.

-   **`<ProtectedLayout>`**: Garante que, se ninguém estiver logado, o conteúdo dentro dele não será exibido.
-   **Animação de Carregamento**: Se `loading` for `true`, ele mostra um esqueleto cinza animado.
-   **Conteúdo Principal**: Se `loading` for `false`, ele exibe os cards com as informações do usuário (pegando os dados do estado `user`), os botões e as informações do sistema.

