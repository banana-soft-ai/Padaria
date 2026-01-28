# 🚀 Setup do Banco de Dados - Rey dos Pães

Este guia explica como configurar o banco de dados Supabase para o sistema Rey dos Pães.

## 📋 Pré-requisitos

1. ✅ Conta no Supabase criada
2. ✅ Projeto Supabase configurado
3. ✅ Variáveis de ambiente no `.env.local`
4. ✅ Sistema rodando localmente

## 🛠️ Passo a Passo

### 1. Executar Script SQL no Supabase

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá para seu projeto
3. Clique em **SQL Editor** no menu lateral
4. Copie o conteúdo do arquivo `scripts/executar-setup.sql`
5. Cole no editor SQL e clique em **Run**

### 2. Criar Usuário Administrador

Após executar o SQL, você precisa criar o usuário administrador:

1. No Supabase Dashboard, vá para **Authentication** > **Users**
2. Clique em **Add user**
3. Preencha:
   - **Email**: `admin@gmail.com`
   - **Password**: `Reginaldo153*`
   - **Confirm email**: ✅ (marque para confirmar automaticamente)
4. Clique em **Create user**

### 3. Verificar Configuração

Para verificar se tudo está funcionando:

```bash
# Executar script de verificação
node scripts/setup-admin.js
```

## 📊 Estrutura do Banco

### Tabelas Principais

- **usuarios** - Usuários do sistema (admin, funcionários, etc.)
- **insumos** - Ingredientes e materiais
- **receitas** - Receitas de produtos
- **produtos** - Produtos finais para venda
- **clientes** - Clientes da padaria
- **caixas** - Controle de caixa
- **vendas** - Vendas realizadas
- **venda_itens** - Itens de cada venda
- **caderneta** - Controle de crédito dos clientes

### Dados Iniciais

O script já insere:
- ✅ 1 usuário administrador
- ✅ 5 insumos básicos (farinha, açúcar, sal, fermento, manteiga)
- ✅ 3 receitas básicas (pão francês, pão de açúcar, bolo de chocolate)
- ✅ 3 produtos básicos

## 🔐 Credenciais Padrão

- **Email**: `admin@gmail.com`
- **Senha**: `Reginaldo153*`

## 🚨 Troubleshooting

### Erro: "Permission denied"

Se você receber erro de permissão:
1. Verifique se está usando a **Service Role Key** (não a Anon Key)
2. Certifique-se de que o RLS está configurado corretamente

### Erro: "Table already exists"

Se as tabelas já existem, o script não irá sobrescrever. Isso é normal.

### Erro: "User already registered"

Se o usuário admin já existe, o script continuará normalmente.

## 📱 Próximos Passos

Após o setup:

1. ✅ Acesse http://localhost:3000/login
2. ✅ Faça login com as credenciais da Lilian
3. ✅ Configure dados da empresa
4. ✅ Adicione mais usuários conforme necessário

## 🔄 Backup e Restauração

Para fazer backup do banco:
1. No Supabase Dashboard, vá para **Settings** > **Database**
2. Clique em **Backup** para baixar um dump do banco

Para restaurar:
1. Use o SQL Editor para executar o script de backup

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do Supabase
2. Confirme se todas as variáveis de ambiente estão corretas
3. Teste a conexão com o banco usando o script de verificação
