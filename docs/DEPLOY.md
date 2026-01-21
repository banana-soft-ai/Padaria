# DEPLOY — Rey dos Pães

Este documento descreve passos práticos para deploy em ambientes típicos (Railway, Docker, docker-compose e CI via GitHub Actions), além de checklist de variáveis de ambiente obrigatórias e recomendações de segurança.

> Importante: Nunca comitar arquivos com chaves sensíveis (`.env.local`). Use secrets/variáveis do provedor de deploy.

---

## 1. Variáveis de ambiente obrigatórias

No ambiente de produção defina as seguintes variáveis (server-side):

- `SUPABASE_SERVICE_ROLE_KEY` — Service Role Key (Supabase → Settings → API → Service Key). Apenas server-side.
- `SUPABASE_URL` — URL do projeto Supabase (ex.: `https://abc123.supabase.co`).
- `SUPABASE_ANON_KEY` — Chave anônima (pode ser exposta ao client como `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- `DATABASE_URL` — Connection string do PostgreSQL (Supabase → Database → Connection string).
- `JWT_SECRET` — Chave secreta usada internamente para assinar tokens JWT.

Opcional (úteis em produção):

- `PORT` — porta HTTP (ex.: `8080`).
- `LOG_LEVEL`, `LOG_FILE_PATH`, `BACKUP_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` etc.

Exemplo mínimo de `.env.local` (apenas para desenvolvimento local — NUNCA comitar):

```env
# Client
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_WITH_PUBLIC_ANON_KEY

# Server (sensitive)
SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_SERVICE_ROLE_KEY
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=REPLACE_WITH_ANON_KEY
DATABASE_URL=postgres://user:password@host:5432/database
JWT_SECRET=replace_with_a_secure_random_string
```

---

## 2. Deploy com Docker (local / production)

Build da imagem:

```bash
docker build -t rey-dos-paes:latest .
```

Executar com arquivo de env (recomendado para testes locais):

```bash
docker run --env-file .env.local -p 8080:8080 rey-dos-paes:latest
```

Em produção, forneça as variáveis via painel do provedor (Railway, ECS, etc.) ou via `--env` individuais.

### docker-compose

O repositório já inclui `docker-compose.yml` que lê `.env.local`:

```bash
# start
docker compose up --build
# ou
docker compose up -d --build
```

> Nota: No `docker-compose.yml` mantemos `env_file: .env.local` apenas para conveniência local. Em produção, prefira configurar variáveis no provedor em vez de um arquivo em disco.

---

## 3. Deploy no Railway (recomendado)

1. Acesse https://railway.app e crie um projeto.
2. Conecte o repositório Git (GitHub/GitLab).
3. Em *Variables* / *Environment Variables*, crie as variáveis listadas na seção 1 com os valores reais.
4. Defina `PORT` se necessário (ex.: `8080`).
5. Habilite o deploy automático por push (ou configure branch especifica).

Railway cuidará do build e do runtime.

---

## 4. Exemplo de GitHub Actions (CI/CD)

Snippet mínimo para build e push de imagem (ajuste conforme seu registry):

```yaml
name: Build and Publish
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          push: true
          tags: ${{ secrets.REGISTRY }}/${{ github.repository }}:latest
          build-args: |
            NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
```

Configure os secrets no repositório (`Settings » Secrets`) ou use o segredo do provedor.

---

## 5. Segurança e boas práticas

- Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no client (não use `NEXT_PUBLIC_`).
- Use `server-env` validado para falha rápida em caso de variáveis essenciais ausentes.
- Roteie/rotate keys do Supabase antes de remover histórico.
- Armazene secrets no provedor (Railway, Vercel, GitHub Secrets) e não no repositório.
- Use RLS (Row Level Security) no Supabase e roles adequadas.

---

## 6. Checklist de deploy

- [ ] Variáveis obrigatórias definidas no ambiente
- [ ] Build passado localmente (`npm run build`)
- [ ] Testes (unitários/integracao) executados
- [ ] Secrets salvos no provedor
- [ ] Deploy automático habilitado (opcional)

---

## Contato

Se precisar que eu gere um workflow de GitHub Actions completo, ou um script de infra (Terraform/Railway CLI), posso criar — diga qual provedor prefere.
