# Documentação: `src/app/logout/page.tsx` - Página de Logout

Este documento explica o funcionamento do arquivo `page.tsx` localizado na pasta `src/app/logout`. O objetivo é ser um guia simples para quem está começando a entender o projeto.

## 🎯 Qual é o objetivo do arquivo?

O objetivo deste arquivo é criar a **página de logout** do sistema. Esta não é uma página que o usuário vê por muito tempo ou com a qual interage. Sua única função é executar o processo de "sair do sistema" de forma segura e automática.

Quando um usuário clica no botão "Sair" em qualquer parte da aplicação, ele é redirecionado para esta página. A página então:

1.  Comunica-se com o Supabase para encerrar a sessão do usuário.
2.  Tenta limpar dados de login armazenados no navegador (como cookies e `localStorage`).
3.  Mostra uma mensagem de status (ex: "Saindo...", "Logout realizado com sucesso!").
4.  Redireciona o usuário de volta para a tela de login (`/login`) após um curto período.

---

## ✨ Principais Funcionalidades da Página

1.  **Logout Automático:** O processo de logout é iniciado assim que a página é carregada, sem a necessidade de qualquer ação do usuário.
2.  **Feedback Visual:** A página exibe mensagens claras e ícones para informar ao usuário o que está acontecendo:
    *   Um ícone de carregamento enquanto o logout está em andamento.
    *   Um ícone de sucesso (`✔`) quando o logout é bem-sucedido.
    *   Um ícone de erro (`❌`) se algo der errado.
3.  **Limpeza de Sessão:** Além de usar o método oficial `signOut()` do Supabase, o código também tenta fazer uma limpeza manual de dados de sessão no navegador para garantir que nenhum resquício da sessão anterior permaneça.
4.  **Redirecionamento Seguro:** Após o processo (seja com sucesso ou erro), o usuário é sempre redirecionado para a página de login, garantindo que ele não fique "preso" em uma página de logout.

---

## ⚙️ Como o Código Funciona (Explicação Simplificada)

O código usa React Hooks para controlar o processo de logout. Vamos entender as partes mais importantes:

### 1. Importações

No início do arquivo, importamos as ferramentas que vamos usar:

```typescript
'use client'

import { useEffect, useState } from 'react' // Hooks do React.
import { useRouter } from 'next/navigation' // Para redirecionar o usuário.
import { supabase } from '@/lib/supabase' // Nossa conexão com o Supabase.
import { CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react' // Ícones para o feedback visual.
```

### 2. Estado da Página com `useState`

Usamos `useState` para guardar o status atual do processo de logout. Pense nisso como a "memória" da página que diz em qual etapa estamos.

```typescript
type LogoutStatus = 'loading' | 'success' | 'error'

const [status, setStatus] = useState<LogoutStatus>('loading') // Começa como 'loading' (carregando).
```

### 3. A Lógica de Logout (`useEffect` e `handleLogout`)

Esta é a parte central do arquivo.

*   `useEffect(() => { ... }, [router, status])`: Este Hook do React executa uma função sempre que a página carrega pela primeira vez (pois `status` é `'loading'`). É aqui que a "mágica" acontece.
*   `handleLogout`: É a função que contém todos os passos para deslogar o usuário.

```typescript
useEffect(() => {
    const handleLogout = async () => {
        try {
            // 1. Tenta fazer o logout no Supabase.
            await supabase.auth.signOut()

            // 2. Tenta limpar dados do navegador (uma segurança extra).
            localStorage.removeItem('sb:token')
            sessionStorage.removeItem('sb:token')
            // ... (código para limpar cookies)

            // 3. Se tudo deu certo, atualiza o status para 'success'.
            setStatus('success')

            // 4. Agenda o redirecionamento para a página de login após 1.5s.
            setTimeout(() => {
                router.replace('/login')
            }, 1500)

        } catch (error) {
            // Se algo deu errado, atualiza o status para 'error'.
            setStatus('error')
            // Também redireciona para o login.
            setTimeout(() => {
                router.replace('/login')
            }, 1500)
        }
    }

    // Chama a função de logout apenas se o status for 'loading'.
    if (status === 'loading') {
        handleLogout()
    }
}, [router, status]) // Dependências do useEffect.
```

### 4. Renderização (O que aparece na tela - JSX)

O `return (...)` no final do arquivo desenha a mensagem na tela. Ele usa uma função `renderMessage` que verifica o valor do estado `status` e retorna o texto e o ícone corretos para cada caso: 'loading', 'success' ou 'error'.

```jsx
const renderMessage = () => {
    switch (status) {
        case 'loading':
            return ( /* ... JSX para mensagem de "Saindo..." ... */ )
        case 'success':
            return ( /* ... JSX para mensagem de "Sucesso!" ... */ )
        case 'error':
            return ( /* ... JSX para mensagem de "Erro." ... */ )
    }
}

return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">{renderMessage()}</div>
    </div>
)
```

Dessa forma, a página executa sua tarefa de forma rápida e eficiente, fornecendo um feedback claro ao usuário antes de mandá-lo de volta para o início do fluxo de autenticação.