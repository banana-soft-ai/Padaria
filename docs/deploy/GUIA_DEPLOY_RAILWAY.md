# 🚀 Guia Completo: Deploy no Railway com Domínio Personalizado

Este guia te ensina passo a passo como colocar o site Rey dos Pães no Railway e conectar com o domínio **reydospaes.scalar-ai.app**.

## ⚡ Resumo Rápido (5 minutos de leitura)

**O que você vai fazer:**
1. ✅ Criar conta no Railway e conectar GitHub
2. ✅ Fazer deploy do projeto (automático)
3. ✅ Configurar domínio reydospaes.scalar-ai.app
4. ✅ Configurar DNS no GoDaddy
5. ✅ Pronto! Site no ar

**Tempo total estimado:** 15-30 minutos

**Custo:** Grátis (com limite mensal generoso)

---

## 📋 Pré-requisitos

- ✅ Conta no Railway (grátis)
- ✅ Conta no GoDaddy
- ✅ Domínio scalar-ai.app configurado no GoDaddy
- ✅ Repositório no GitHub
- ✅ Conta no Supabase

---

## 🎯 PARTE 1: Preparar o Projeto para o Railway

### Passo 1.1: Adicionar o Arquivo Railway

O arquivo `railway.json` já existe e está correto! ✅

### Passo 1.2: Verificar package.json

Confirme que os seguintes scripts estão no `package.json`:

```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start"
}
```

✅ Já está correto!

### Passo 1.3: Atualizar next.config.ts para Produção

Adicione a configuração `output: 'standalone'` no arquivo `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  // ... outras configurações
  output: 'standalone',
  // ... resto do código
}
```

Isso otimiza o build para produção.

---

## 🌐 PARTE 2: Criar Conta no Railway

### Passo 2.1: Acessar o Railway

1. Vá para: **https://railway.app/**
2. Clique em **"Start a New Project"** ou **"Login"**
3. Escolha **"Sign up with GitHub"** (recomendado)

### Passo 2.2: Autorizar o Railway

1. Autorize o Railway a acessar seus repositórios GitHub
2. Escolha quais repositórios dar acesso (você pode dar acesso a todos)

---

## 🔗 PARTE 3: Deploy do Projeto no Railway

### Passo 3.1: Criar Novo Projeto

1. No painel do Railway, clique em **"+ New Project"**
2. Escolha **"Deploy from GitHub repo"**
3. Selecione o repositório **"Rey Dos Paes"**
4. Aguarde o Railway detectar automaticamente que é um projeto Next.js

### Passo 3.2: Configurar Build

O Railway deve detectar automaticamente:
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

Se não detectar, configure manualmente:
1. Vá em **"Settings"** → **"Build & Deploy"**
2. **Build Command**: `npm run build`
3. **Start Command**: `npm start`

---

## 🔐 PARTE 4: Configurar Variáveis de Ambiente

### Passo 4.1: Adicionar Variáveis no Railway

No painel do Railway:

1. Clique no projeto que você criou
2. Vá em **"Variables"** (ou **"Environment Variables"**)
3. Clique em **"+ New Variable"**
4. Adicione APENAS estas 3 variáveis:

**Variável 1:**
```
Nome: NEXT_PUBLIC_SUPABASE_URL
Valor: https://seu-projeto.supabase.co
```

**Variável 2:**
```
Nome: NEXT_PUBLIC_SUPABASE_ANON_KEY
Valor: sua_chave_anonima_do_supabase
```

**Variável 3:**
```
Nome: NODE_ENV
Valor: production
```

**NOTA**: Estas são as ÚNICAS variáveis necessárias. O projeto já usa `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` para conectar com o Supabase.

### Passo 4.2: Obter Dados do Supabase

Se ainda não tem as chaves do Supabase:

1. Acesse **https://supabase.com/dashboard**
2. Selecione seu projeto
3. Vá em **"Settings"** → **"API"**
4. Copie:
   - **Project URL** → Cole em `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** (chave) → Cole em `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Exemplo:**
- Project URL: `https://abcdefgh.supabase.co`
- anon public: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## 🚀 PARTE 5: Primeiro Deploy

### Passo 5.1: Fazer Deploy

1. No painel do Railway, clique em **"Deploy"** ou aguarde o deploy automático
2. Aguarde o build terminar (pode levar 2-5 minutos)
3. Se der erro, clique no log para ver os detalhes

### Passo 5.2: Verificar Status

1. Aguarde até aparecer: **"Deployed successfully"**
2. Clique no domínio temporário do Railway (exemplo: `reydospaes-production.up.railway.app`)
3. Teste se o site está funcionando

---

## 🌍 PARTE 6: Configurar Domínio Personalizado

### Passo 6.1: Adicionar Domínio no Railway

1. No painel do Railway, clique no projeto
2. Vá em **"Settings"** → **"Domains"**
3. Clique em **"+ Custom Domain"**
4. Digite: **reydospaes.scalar-ai.app**
5. Clique em **"Add"**

### Passo 6.2: Configurar DNS no GoDaddy

O Railway vai te mostrar as instruções de DNS. Vá ao GoDaddy:

1. Acesse **https://www.godaddy.com**
2. Faça login na sua conta
3. Vá em **"My Products"**
4. Encontre o domínio **scalar-ai.app**
5. Clique em **"DNS"** ou **"Manage DNS"**

### Passo 6.3: Adicionar Registro CNAME

No painel de DNS do GoDaddy, adicione um novo registro:

**Tipo**: CNAME  
**Nome**: `reydospaes` (ou `@` se quiser o domínio principal)  
**Valor**: O que o Railway te forneceu (exemplo: `reydospaes-production.up.railway.app`)  
**TTL**: 600 (ou automático)

**IMPORTANTE**: 
- Se você quer usar **reydospaes.scalar-ai.app**, use Nome = `reydospaes`
- Se você quer usar **scalar-ai.app** direto, use Nome = `@`

### Passo 6.4: Salvar e Aguardar Propagação

1. Clique em **"Save"** no GoDaddy
2. Aguarde 5-30 minutos para o DNS propagar
3. No Railway, aguarde até aparecer: **"DNS is correctly configured"**

### Passo 6.5: Testar o Domínio

1. Abra o navegador
2. Digite: **https://reydospaes.scalar-ai.app**
3. Se funcionar, você verá o site!

**Nota**: O Railway já configura SSL/HTTPS automaticamente! 🔒

---

## ✅ PARTE 7: Verificar Tudo Está Funcionando

### Checklist Final:

- [ ] Site abre no domínio reydospaes.scalar-ai.app
- [ ] HTTPS está funcionando (cadeado verde no navegador)
- [ ] Login está funcionando
- [ ] Conexão com Supabase está ok
- [ ] Dados estão carregando corretamente
- [ ] PWA está funcionando (offline)
- [ ] Nenhum erro no console do navegador

### Como Testar:

1. **Login**: Teste fazer login no sistema
2. **Estoque**: Verifique se os dados carregam
3. **Receitas**: Teste carregar receitas
4. **Vendas**: Teste criar uma venda
5. **Caderneta**: Verifique clientes
6. **Offline**: Desconecte a internet e veja se funciona

---

## 🔧 PARTE 8: Configurações Avançadas (Opcional)

### 8.1: Deploy Automático

O Railway já faz deploy automático sempre que você:
- Faz push para a branch `main` ou `master`
- Faz merge de um Pull Request

### 8.2: Branch de Produção

Se quiser usar uma branch específica:

1. Vá em **Settings** → **Source**
2. Selecione a branch desejada
3. Clique em **Save**

### 8.3: Monitoramento

1. Vá em **Metrics** para ver CPU, RAM e logs
2. Configure alertas se necessário
3. Monitore performance do site

### 8.4: Rollback

Se algo der errado:

1. Vá em **Deployments**
2. Clique nas **3 pontinhos** de um deploy antigo
3. Escolha **"Redeploy"**

---

## 🐛 Problemas Comuns e Soluções

### Problema 1: Build Falha

**Causa**: Variáveis de ambiente faltando ou incorretas  
**Solução**: Verifique todas as variáveis obrigatórias no painel

### Problema 2: Domínio não funciona

**Causa**: DNS ainda não propagou  
**Solução**: Aguarde mais 30 minutos, DNS pode levar até 24h

### Problema 3: Site abre mas dá erro de API

**Causa**: Variáveis do Supabase incorretas  
**Solução**: Verifique se copiou as chaves corretamente

### Problema 4: SSL não funciona

**Causa**: Configuração DNS errada  
**Solução**: Verifique se o CNAME está correto no GoDaddy

---

## 📞 Suporte

Se tiver problemas:

1. **Logs do Railway**: Veja os logs do build em tempo real
2. **Documentação**: https://docs.railway.app/
3. **Status**: https://status.railway.app/

---

## 🎉 Pronto!

Seu site **Rey dos Pães** agora está:
- ✅ Rodando no Railway
- ✅ Com domínio personalizado
- ✅ Com HTTPS automático
- ✅ Com deploy automático
- ✅ Pronto para produção!

Acesse: **https://reydospaes.scalar-ai.app**

---

**Importante**: Sempre que fizer alterações no código e enviar para o GitHub, o Railway vai fazer deploy automático em 2-5 minutos!
