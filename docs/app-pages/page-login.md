# Documentação: `src/app/login/page.tsx` - Página de Login

Este documento explica o funcionamento do arquivo `page.tsx` localizado na pasta `src/app/login`. O objetivo é ser um guia simples para quem está começando a entender o projeto.

## 🎯 Qual é o objetivo do arquivo?

O objetivo deste arquivo é criar a **página de login** do sistema "Rey dos Pães". É a porta de entrada da aplicação, onde o usuário insere seu email e senha para obter acesso às funcionalidades de gestão.

A página é responsável por:
1.  Coletar as credenciais do usuário (email e senha).
2.  Permitir que o usuário veja a senha que está digitando.
3.  Comunicar-se com o Supabase (nosso banco de dados e sistema de autenticação) para verificar se as credenciais são válidas.
4.  Mostrar mensagens de sucesso ou erro.
5.  Redirecionar o usuário para a página principal (dashboard) após um login bem-sucedido.

---

## ✨ Principais Funcionalidades da Página

1.  **Formulário de Acesso:** Contém campos para "Email" e "Senha".
2.  **Visualização de Senha:** Um ícone de olho (👁️) ao lado do campo de senha permite que o usuário alterne a visibilidade da senha, ajudando a evitar erros de digitação.
3.  **Feedback Visual:**
    *   Quando o usuário clica em "Entrar", o botão é desativado e o texto muda para "Entrando...", indicando que o sistema está processando a solicitação.
    *   Uma mensagem (chamada de "toast") aparece para informar sobre o sucesso ou a falha do login.
4.  **Segurança:** A comunicação com o Supabase é segura, e a página lida com erros comuns, como "usuário ou senha incorretos".
5.  **Redirecionamento Automático:** Após o login ser validado, o usuário é automaticamente enviado para a página inicial do sistema.

---

## ⚙️ Como o Código Funciona (Explicação Simplificada)

O código usa React com Hooks para criar uma página interativa. Vamos entender as partes mais importantes:

### 1. Importações

No início do arquivo, importamos as ferramentas que vamos usar:

```typescript
'use client'

import { useState } from 'react' // Hook do React para guardar "memórias" na página.
import { useRouter } from 'next/navigation' // Para redirecionar o usuário para outras páginas.
import { supabase } from '@/lib/supabase' // Nossa conexão com o Supabase para autenticação.
import { useLogger } from '@/lib/logger' // Um utilitário para registrar eventos (logs).
import { Eye, EyeOff } from 'lucide-react' // Ícones de olho para mostrar/ocultar a senha.
```

### 2. Estados da Página com `useState`

Usamos `useState` para guardar informações que mudam na tela. Pense neles como a "memória" da página.

```typescript
const [email, setEmail] = useState('') // Guarda o email que o usuário digita.
const [password, setPassword] = useState('') // Guarda a senha.
const [loading, setLoading] = useState(false) // Controla se a página está "carregando" o login.
const [error, setError] = useState('') // Guarda mensagens de erro.
const [toast, setToast] = useState</*...*/>(null) // Guarda a mensagem de sucesso/erro que some depois.
const [showPassword, setShowPassword] = useState(false) // Controla se a senha está visível ou não.
```

### 3. A Função de Login (`handleLogin`)

Esta é a função mais importante. Ela é executada quando o usuário clica no botão "Entrar".

```typescript
const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault() // Impede que a página recarregue ao enviar o formulário.
    setLoading(true) // Avisa a página que o login começou.

    // Tenta fazer o login no Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    // Se o Supabase retornar um erro...
    if (error) {
        // Define uma mensagem amigável para o usuário.
        const message = 'Usuário ou senha incorretos'
        setError(message) // Guarda o erro (se precisar).
        setToast({ message, type: 'error' }) // Mostra o toast de erro.
        return // Para a execução da função aqui.
    }

    // Se o login der certo...
    if (data.user) {
        // Mostra um toast de sucesso.
        setToast({ message: 'Login feito com sucesso!', type: 'success' })

        // Espera 1.5 segundos para o usuário ver a mensagem e depois o redireciona.
        setTimeout(() => {
            router.replace('/') // Leva o usuário para a página inicial.
        }, 1500)
    }

    // No final, independentemente de sucesso ou erro...
    setLoading(false) // Avisa a página que o processo de login terminou.
}
```

### 4. Renderização (O que aparece na tela - JSX)

O `return (...)` no final do arquivo contém o código que desenha a página.

*   **`<form onSubmit={handleLogin}>`**: Define que a função `handleLogin` será chamada quando o formulário for enviado.
*   **`<input>` de Email e Senha**: Os campos de texto estão ligados aos estados `email` and `password`. Quando o usuário digita, a função `onChange` atualiza esses estados.
*   **Botão de Mostrar/Ocultar Senha**: Este botão simplesmente inverte o valor do estado `showPassword` (`true` vira `false` e vice-versa). O `type` do input de senha muda de `"password"` para `"text"` com base nesse estado.
    ```jsx
    <input type={showPassword ? "text" : "password"} />
    ```
*   **Mensagem de Toast**: O `div` que mostra a mensagem de sucesso ou erro só aparece na tela se o estado `toast` não for nulo.
    ```jsx
    {toast && ( /* ... código do toast ... */ )}
    ```
*   **Botão de Entrar**: O atributo `disabled={loading}` desativa o botão enquanto o login está sendo processado para evitar cliques duplos. O texto do botão também muda:
    ```jsx
    {loading ? 'Entrando...' : 'Entrar'}
    ```
