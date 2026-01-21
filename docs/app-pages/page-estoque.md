# Documentação: `src/app/estoque/page.tsx` - Dashboard de Estoque

Este documento explica o funcionamento do arquivo `page.tsx` localizado na pasta `src/app/estoque`. O objetivo é ser um guia simples para quem está começando a entender o projeto.

## 🎯 Qual é o objetivo do arquivo?

O objetivo deste arquivo é criar a página **"Dashboard de Estoque"** no sistema. Esta página funciona como um painel de visualização, permitindo que o usuário veja rapidamente a situação de todos os insumos (ingredientes, embalagens, etc.) cadastrados.

É uma página de **"somente leitura"**, ou seja, o usuário pode ver as informações, pesquisar e filtrar, mas não pode adicionar, editar ou excluir itens diretamente daqui. Para gerenciar os itens, existe outra tela (`/gestao/estoque`).

---

## ✨ Principais Funcionalidades da Página

1.  **Resumo Rápido:** Mostra cartões com números importantes:
    *   Total de insumos cadastrados.
    *   Quantos estão "Sem estoque".
    *   Quantos estão com "Estoque baixo".
    *   Quantos estão "Em estoque".

2.  **Busca:** Permite que o usuário digite o nome de um insumo para encontrá-lo facilmente na lista.

3.  **Filtros:** Botões que filtram a lista para mostrar apenas os insumos com um status específico (ex: mostrar apenas os que estão com estoque baixo).

4.  **Lista de Insumos:** Exibe todos os insumos, mostrando o nome, a quantidade em estoque e um ícone colorido que representa seu status.

5.  **Ver Detalhes:** Ao clicar no ícone de "olho" (👁️), uma pequena janela (modal) se abre, mostrando mais detalhes sobre o insumo selecionado, como categoria, fornecedor, etc.

---

## ⚙️ Como o Código Funciona (Explicação Simplificada)

O código usa React com Hooks para criar uma página dinâmica e interativa. Vamos ver as partes principais:

### 1. Importações

No início do arquivo, importamos tudo o que precisamos:

```typescript
import { useEffect, useState } from 'react' // Hooks do React
import { supabase, Insumo } from '@/lib/supabase' // Conexão com o banco de dados e o tipo 'Insumo'
import ProtectedLayout from '@/components/ProtectedLayout' // Layout que protege a página
import { Package, AlertTriangle, X, Eye, Search } from 'lucide-react' // Ícones
```

### 2. Estados da Página com `useState`

Usamos `useState` para guardar informações que podem mudar na tela. Pense neles como "memórias" do componente.

```typescript
const [insumos, setInsumos] = useState<Insumo[]>([]) // Guarda a lista de todos os insumos.
const [loading, setLoading] = useState(true) // Controla se a mensagem "Carregando..." aparece.
const [insumoSelecionado, setInsumoSelecionado] = useState<Insumo | null>(null) // Guarda o insumo que o usuário clicou para ver os detalhes.
const [pesquisa, setPesquisa] = useState('') // Guarda o texto que o usuário digita na busca.
const [filtroStatus, setFiltroStatus] = useState<'todos' | ...>('todos') // Guarda qual filtro está ativo.
```

### 3. Carregando os Dados do Banco (`useEffect` e `carregarInsumos`)

Quando a página abre, precisamos buscar os dados dos insumos no banco de dados (Supabase).

-   `useEffect(() => { ... }, [])`: Este Hook do React executa uma função uma única vez, assim que a página é carregada.
-   `carregarInsumos`: É a função que chamamos dentro do `useEffect`. Ela se conecta ao Supabase, pede a tabela `insumos`, ordena por nome e guarda os dados no estado `insumos`.

```typescript
useEffect(() => {
  carregarInsumos()
}, [])

const carregarInsumos = async () => {
  // ... código que busca os dados no Supabase ...
  setInsumos(data || []) // Salva os dados na "memória"
  setLoading(false) // Para de mostrar a mensagem "Carregando..."
}
```

### 4. Lógica de Status e Filtros

-   **`obterStatusEstoque(insumo)`**: Uma função muito importante! Ela recebe um insumo e verifica a quantidade em `estoque_atual` e `estoque_minimo`. Com base nisso, ela retorna um objeto com o texto do status ("Sem estoque", "Estoque baixo", etc.), a cor e o ícone correspondente.

-   **`insumosFiltrados`**: Antes de mostrar a lista na tela, criamos uma nova lista chamada `insumosFiltrados`. Ela pega a lista original de `insumos` e aplica a busca (pelo `pesquisa`) e o filtro de status (pelo `filtroStatus`). É essa lista filtrada que o usuário vê na tela.

```typescript
const insumosFiltrados = insumos.filter(insumo => {
  // ... lógica para verificar se o insumo corresponde à pesquisa e ao filtro ...
  return nomeMatch && statusMatch
})
```

### 5. Renderização (O que aparece na tela - JSX)

O `return (...)` no final do arquivo contém o código HTML (escrito em JSX) que desenha a página.

-   **`<ProtectedLayout>`**: "Abraça" toda a página para garantir que apenas usuários logados possam acessá-la.
-   **Cards de Resumo**: Mapeiam os dados calculados (como `semEstoque.length`) para mostrar os totais.
-   **Barra de Pesquisa e Filtros**: São elementos `<input>` e `<button>` que, quando alterados, atualizam os estados `pesquisa` e `filtroStatus`, fazendo a lista se atualizar automaticamente.
-   **Lista de Insumos**: Usa a função `.map()` em `insumosFiltrados` para criar uma linha (`<div>`) para cada insumo na lista.
-   **Modal de Detalhes**: É um `<div>` que só aparece na tela se `insumoSelecionado` não for nulo. Ele mostra as informações do insumo que está guardado nesse estado. O botão de fechar (`<X />`) simplesmente limpa o estado, fazendo o modal desaparecer.

```jsx
{insumoSelecionado && (
  // O código do Modal só aparece se um insumo for selecionado
  <div className="fixed ...">
    {/* ... detalhes do insumo ... */}
  </div>
)}
```