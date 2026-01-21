## Instruções rápidas para agentes de código (Copilot / AI)

Este arquivo resume o conhecimento essencial para trabalhar neste repositório "Rey dos Pães" e agilizar mudanças seguras e consistentes.

1. Visão geral
- Framework principal: Next.js 15 + React 19 + TypeScript.
- Backend de dados: Supabase (Postgres) com Row Level Security (RLS). Veja `migrations/` e `scripts/sql/` para esquema e políticas.
- Entrada do servidor: `server.js` — o app usa um servidor Next custom (útil para health checks e logs).

2. Comandos úteis
- Desenvolvimento: `npm run dev` (não passa `--turbopack` por padrão no Windows).
- Build: `npm run build`.
- Start (produção): `npm start` (executa `server.js`).
- Verificação de ambiente: `npm run check-env`.
- Scripts administrativos: `npm run setup-admin`.
- Testes: `npm test`, `npm run test:watch`, `npm run test:coverage` (Jest).

3. Convenções específicas do projeto
- Camadas:
  - `src/app/` → UI e pages (Next.js App Router);
  - `src/components/` → componentes React reutilizáveis;
  - `src/services/` → lógica de negócio (nova canonical location);
  - `src/repositories/` → acesso a dados / queries SQL;
  - `src/lib/` → utilitários, cliente Supabase e wrappers (não lógica de negócio);

- Variáveis de ambiente:
  - Sempre use chaves server-side sem `NEXT_PUBLIC_` para segredos (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `JWT_SECRET`).
  - Chaves públicas do cliente podem usar `NEXT_PUBLIC_SUPABASE_...`.

- Banco de dados & migrations:
  - SQL organizados em `migrations/`, `scripts/sql/` e `db/`.
  - Ao alterar esquema, adicione migration e atualize `docs/setup/` se necessário.

4. Padrões de alteração de código
- Quando adicionar uma nova feature que toca DB:
  - Criar migration em `migrations/`;
  - Adicionar acesso em `src/repositories/` e lógica em `src/services/`;
  - Atualizar ou adicionar testes em `tests/`.

- Evite colocar lógica de negócio em componentes UI; use `services` e `repositories`.

5. Integrações e pontos de atenção
- Supabase: existe integração direta no código (`@supabase/supabase-js`) — procure `src/lib/supabase` ou usos de `createClient`.
- OpenAI: a dependência `openai` aparece no `package.json` — verificar usos antes de modificar.
- Offline / scripts: há scripts utilitários em `scripts/js/` e `js/` (legacy). Prefira novos helpers em `src/lib/`.

6. Debug e logs
- `server.js` já imprime presença das envs e cada request com tempo; usar esse padrão para log de endpoints server-side.

7. Testes e CI
- Tests: Jest configurado; exemplos em `tests/` e `jest.config.js`.
- CI: README contém exemplo de pipeline (GitHub Actions) e instruções para Railway/Vercel.

8. Como revisar PRs (dicas rápidas para agentes)
- Verifique migrations e alterações em `migrations/` quando PR tocar models.
- Garanta que variáveis sensíveis NÃO vazem para o frontend (`NEXT_PUBLIC_` prefixado é o único permitido no client).
- Caso adicione rota/endpoint, verifique `server.js` health endpoints e logs.

9. Onde procurar exemplos no repo
- Implementações de UI: `src/app/*` (páginas como `estoque`, `vendas`, `receitas`).
- Acesso ao DB e scripts: `migrations/`, `scripts/`, `db/`.
- Entrypoint: `server.js` (na raiz do projeto) e [package.json](../package.json) (scripts).

Se algo estiver incompleto ou você precisar de convenções adicionais (naming, testes unitários exemplares, ou exemplos de `src/services`), solicite e eu adiciono amostras específicas.
