# Rey dos Pães - Sistema de Gestão para Padaria

Sistema completo de gestão para a padaria Rey dos Pães, desenvolvido com Next.js, TypeScript, Tailwind CSS e Supabase.

## 🚀 Funcionalidades

### 📦 Estoque
- Gestão de produtos e insumo
- Controle de preços unitários
- Alertas de estoque baixo
- Categorização de produto

### 👨‍🍳 Receitas
- Cadastro de receitas com instruções
- Composição de ingredientes
- Cálculo automático de custos
- Controle de rendimento

### 🛒 Vendas
- Registro de vendas de receitas
- Vendas de produtos de varejo
- Histórico completo de vendas
- Relatórios de faturamento
- Sistema de caderneta para clientes

### 📊 Gestão
- Análise de margem de lucro
- Fluxo de caixa detalhado
- Gráficos e relatórios
- Balanço financeiro
- Controle de caixa diário

### 🏪 Caderneta
- Gestão de clientes fiéis
- Controle de limite de crédito
- Histórico de compras
- Acompanhamento de saldo devedor

## 🛠️ Tecnologias Utilizadas

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Banco de Dados**: Supabase (PostgreSQL)
- **Gráficos**: Recharts
- **Ícones**: Lucide React
- **Deploy**: Railway

## 📋 Pré-requisitos

- Node.js 20+
- npm 10+
- Conta no Supabase

## 🔧 Instalação

### 1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd rey-dos-paes
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o Supabase

#### 3.1 Crie um projeto no Supabase
1. Acesse [supabase.com](https://supabase.com)
2. Crie uma nova conta ou faça login
3. Crie um novo projeto
4. Anote a URL e a chave anônima do projeto

#### 3.2 Execute o script SQL
1. No painel do Supabase, vá para "SQL Editor"
2. Crie as tabelas necessárias para o sistema

### 4. Configure as variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto baseado no `env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

### 5. Execute o projeto
```bash
npm run dev
```

O sistema estará disponível em `http://localhost:3000`

> **Nota:** por padrão o comando acima roda sem **Turbopack** (mais estável em Windows). Se quiser testar o Turbopack (experimental), execute:
>
> ```bash
> npm run dev -- --turbopack
> ```
>
> Se encontrar erros do tipo `ENOENT` ao escrever arquivos em `.next`, prefira rodar sem o `--turbopack`.  

## 📁 Estrutura do Projeto

```
rey-dos-paes/
├── src/
│   ├── app/                 # Páginas da aplicação
│   │   ├── page.tsx         # Dashboard
│   │   ├── estoque/         # Gestão de estoque
│   │   ├── receitas/        # Gestão de receitas
│   │   ├── vendas/          # Registro de vendas
│   │   ├── caderneta/       # Sistema de caderneta
│   │   ├── gestao/          # Análise financeira
│   │   └── configuracoes/   # Configurações
│   ├── components/          # Componentes reutilizáveis
│   ├── hooks/               # Custom hooks
│   ├── lib/                 # Configurações e utilitários
│   └── types/               # Definições de tipos
├── public/                  # Arquivos estáticos
└── README.md               # Este arquivo
```

## 🚀 Como Usar

### 1. Configuração Inicial
1. Acesse a página "Configurações"
2. Configure as informações da padaria Rey dos Pães
3. Verifique a conexão com o banco de dados

### 2. Cadastro de Insumos
1. Vá para "Estoque"
2. Clique em "Novo Insumo"
3. Preencha as informações dos produtos e ingredientes

### 3. Cadastro de Receitas
1. Vá para "Receitas"
2. Clique em "Nova Receita"
3. Preencha as informações da receita
4. Adicione os insumos necessários com suas quantidades

### 4. Registro de Vendas
1. Vá para "Vendas"
2. Clique em "Nova Venda"
3. Selecione o tipo (receita ou varejo)
4. Escolha o item e informe a quantidade

### 5. Sistema de Caderneta
1. Vá para "Caderneta"
2. Cadastre clientes fiéis
3. Configure limites de crédito
4. Acompanhe vendas a prazo

### 6. Análise Financeira
1. Vá para "Gestão"
2. Visualize os gráficos de margem de lucro
3. Acompanhe o fluxo de caixa
4. Registre entradas e saídas adicionais

## 📊 Relatórios Disponíveis

- **Dashboard**: Visão geral com principais indicadores
- **Margem de Lucro**: Análise detalhada por item
- **Fluxo de Caixa**: Controle de entradas e saídas
- **Histórico de Vendas**: Relatório completo de vendas
- **Estoque Baixo**: Alertas de produtos com estoque mínimo
- **Clientes Caderneta**: Relatório de saldos devedores

## 🔒 Segurança

- Todas as tabelas possuem Row Level Security (RLS) habilitado
- Políticas de acesso configuradas
- Validação de dados no frontend e backend

## 🚀 Deploy

### Railway (Recomendado)
1. Conecte seu repositório ao Railway
2. Configure as variáveis de ambiente
3. Deploy automático a cada push

### Vercel
1. Conecte seu repositório ao Vercel
2. Configure as variáveis de ambiente
3. Deploy automático

## 🔑 Variáveis de Ambiente (Obrigatórias)

No ambiente de produção (Railway, Docker, Vercel, etc.) é obrigatório definir as variáveis abaixo. **NÃO** exponha estas chaves no front-end — use apenas variáveis server-side (sem `NEXT_PUBLIC_`) para chaves sensíveis.

- `SUPABASE_SERVICE_ROLE_KEY` — Service Role Key do Supabase (Settings → API → Service Key). Apenas server-side.
- `SUPABASE_URL` — URL do seu projeto Supabase.
- `SUPABASE_ANON_KEY` — Chave anônima pública (pode ser exposta como `NEXT_PUBLIC_SUPABASE_ANON_KEY` para o client).
- `DATABASE_URL` — Connection string do PostgreSQL (Supabase Database → Connection string).
- `JWT_SECRET` — Chave secreta usada para assinar JWTs (string segura).

Exemplo mínimo de `.env.local` (local development — NÃO comitar este arquivo):

```env
# Client (pode ser exposto ao navegador)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_WITH_PUBLIC_ANON_KEY

# Server (NUNCA usar NEXT_PUBLIC_ aqui)
SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_SERVICE_ROLE_KEY
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=REPLACE_WITH_ANON_KEY
DATABASE_URL=postgres://user:password@host:5432/database
JWT_SECRET=replace_with_a_secure_random_string
```

## 🚢 Deploy com Docker

Buildar a imagem localmente e passar variáveis via `docker run` ou `--env-file`:

```bash
# Build
docker build -t rey-dos-paes:latest .

# Run usando arquivo .env.local (recomendado para local testing)
docker run --env-file .env.local -p 8080:8080 rey-dos-paes:latest
```

Se usar `docker-compose`, adicione as variáveis no `.env.local` e o `docker-compose.yml` já carrega `env_file: .env.local`.

## 🚀 Deploy no Railway

1. No painel do Railway, conecte o repositório Git.
2. Em Settings → Environment Variables, adicione as variáveis obrigatórias listadas acima (cole os valores reais).
3. Defina a variável `PORT` (ex.: `8080`) se quiser sobrescrever a porta padrão.
4. O Railway fará build automático a cada push.

## 🔁 Exemplo CI — GitHub Actions (build + push para registry)

Este é um exemplo genérico que constrói a imagem e publica num registry (ajuste para o seu provider):

```yaml
name: CI

on: [push]

jobs:
	build:
		runs-on: ubuntu-latest
		steps:
			- uses: actions/checkout@v4
			- name: Set up Node
				uses: actions/setup-node@v4
				with:
					node-version: '20'
			- name: Build Docker image
				uses: docker/build-push-action@v4
				with:
					push: true
					tags: ${{ secrets.REGISTRY }}/${{ github.repository }}:latest
					build-args: |
						NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
			# Configure secrets in the repository settings (e.g., REGISTRY, SUPABASE keys, DATABASE_URL, JWT_SECRET)
```

> Observação: em CI/CD nunca guarde chaves sensíveis em texto no repositório — use secrets do GitHub, variáveis do Railway ou do provedor de CI.

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT.

## 🆘 Suporte

Para dúvidas ou problemas:
1. Verifique a documentação
2. Abra uma issue no GitHub
3. Entre em contato com o desenvolvedor

## 🔄 Atualizações

Para manter o sistema atualizado:
```bash
git pull origin main
npm install
npm run dev
```

---

**Desenvolvido com ❤️ para a Padaria Rey dos Pães**

# Atualização 1.0

## Visão Geral da Refatoração
Esta atualização reorganizou completamente o projeto para seguir padrões profissionais, garantindo escalabilidade, clareza e manutenção a longo prazo.

## Estrutura Final do Projeto
```
/
├── src/
│   ├── app/                # UI e páginas (Next.js)
│   ├── components/         # Componentes reutilizáveis
│   ├── hooks/              # Custom hooks
│   ├── services/           # Lógica de negócio
│   ├── repositories/       # Acesso a dados
│   ├── scripts/            # Scripts utilitários
│   └── types/              # Tipos TypeScript
├── public/                 # Arquivos estáticos
├── scripts/
│   ├── sql/                # Scripts SQL
│   └── js/                 # Scripts JavaScript
├── tests/                  # Testes unitários e de integração
├── docs/                   # Documentação
├── config/                 # Configurações
└── README.md               # Documentação principal
```

## Alterações Realizadas

### Limpeza Estrutural
- Pastas unificadas:
	- `src/lib/services/*` -> `src/services/*` (serviços de negócio centralizados)
	- `scripts/scripts.js/*` -> `scripts/js/*` (scripts JS padronizados)
- Pastas removidas/obsoletas:
	- `src/lib/services/` (substituída por `src/services/`)
	- `src/scripts/` (vazia)
	- `src/repositories/supabase.repository.ts` e `src/repositories/offline-storage.repository.ts` (funcionalidades agora em `src/lib/supabase` e `src/lib/offlineStorage`)

### Arquivos Movidos
- Scripts SQL e JS foram reorganizados em `scripts/sql` e `scripts/js`.
- Testes foram movidos para a pasta `tests`.

### Arquivos Renomeados
- Nenhum arquivo foi renomeado.

### Justificativas Técnicas
- **Separação de responsabilidades**: UI, lógica de negócio e acesso a dados foram organizados em camadas distintas.
- **Aliases**: Adicionados no `tsconfig.json` para facilitar os imports.
- **Testes**: Centralizados em uma pasta dedicada para melhor organização.
 - **Serviços**: `src/services` é a pasta canônica para serviços; `lib` permanece para utilitários, configuração e clientes (ex.: Supabase).
 - **Infra**: Cliente Supabase e armazenamento offline consolidado em `src/lib/supabase` e `src/lib/offlineStorage`.

## Status Atual do Projeto
- **Funcionalidade**: O projeto está funcional e pronto para produção.
- **Erros**: Todos os erros foram corrigidos.
- **Testes**: Configuração do Jest validada e funcional.

## Observações Importantes
- Certifique-se de atualizar as variáveis de ambiente para o Supabase.
- Utilize os aliases configurados para novos imports.

---

Para dúvidas ou melhorias, entre em contato com o responsável pelo projeto.
att
