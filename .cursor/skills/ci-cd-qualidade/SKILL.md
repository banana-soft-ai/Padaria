---
name: ci-cd-qualidade
description: Mantém e evolui o pipeline de CI/CD de qualidade do Rey dos Pães (lint, typecheck, testes, cobertura, build). Use quando configurar ou alterar GitHub Actions, adicionar jobs de qualidade, definir gates de merge ou quando o usuário pedir CI/CD, pipeline de qualidade ou integração contínua.
---

# CI/CD de Qualidade — Rey dos Pães

## Objetivo

Garantir que cada push/PR passe por lint, typecheck, testes e build antes de merge. Integra com o [agente-testes](../agente-testes/SKILL.md) para convenções de teste.

## Stack do pipeline

- **CI**: GitHub Actions
- **Node**: 20.x (LTS), conforme `package.json` engines
- **Comandos**: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run test:coverage`, `npm run build`

## Jobs obrigatórios

1. **lint** — `npm run lint` (ESLint)
2. **typecheck** — `npx tsc --noEmit`
3. **test** — `npm run test` (Jest); falha se algum teste quebrar
4. **coverage** — `npm run test:coverage`; opcional: falhar se cobertura cair abaixo de um mínimo (ex.: 60%)
5. **build** — `npm run build` (Next.js); garante que o app compila

Ordem sugerida: lint e typecheck em paralelo; em seguida test; coverage pode ser no mesmo job que test ou separado; build por último (ou em paralelo com test se quiser velocidade).

## Convenções

- Usar `npm ci` (não `npm install`) em CI.
- Cache de `node_modules` (e opcionalmente `~/.npm`) para acelerar.
- Testes e cobertura seguem a estrutura e critérios do agente-testes (Jest, Testing Library, cenários PDV/caixa/caderneta/offline).
- Não expor segredos; usar variáveis de ambiente apenas para build quando necessário (ex.: `NEXT_PUBLIC_*` já no repositório ou em GitHub env).

## Quando alterar o pipeline

- Adicionar novo job quando surgir novo comando de qualidade (ex.: formatação, segurança).
- Atualizar versão do Node quando o projeto subir de engine.
- Ajustar thresholds de cobertura em `jest.config.js` e no workflow se o time definir metas.

## Gates explícitos (branch protection)

Os **status checks** que a branch principal deve exigir devem ter **nomes idênticos** aos jobs do workflow. Exemplo:

| Job no workflow | Nome do check (branch protection) |
|-----------------|-------------------------------------|
| `lint`          | lint                                |
| `typecheck`     | typecheck                           |
| `test`          | test                                |
| `build`         | build                               |
| `coverage`      | coverage (opcional; pode só reportar) |

Configurar em: Settings → Branches → Branch protection rules → Require status checks to pass.

## Cobertura

- **Mínimo:** definir em `jest.config.js` (ex.: 60% global) e, se quiser falhar o build, no workflow com `coverage` job.
- **Onde configurar:** thresholds em `jest.config.js`; decisão de falhar ou só reportar no YAML do workflow. Documentar no skill ou em `docs/` para o time.

## Segredos e variáveis de ambiente

- **Nunca** commitar chaves ou segredos. Variáveis do workflow apenas via GitHub Secrets ou GitHub Environments.
- **Build:** usar apenas `NEXT_PUBLIC_*` já previstas no projeto (ver **project-context** e regras do repositório). Não adicionar novas env sensíveis ao workflow.

## Arquivos

- Workflow principal: `.github/workflows/quality.yml` (ou `ci.yml`).
- Referência de gates: ver comentários no YAML do workflow.
- Branch protection: exigir os checks listados acima na branch principal.
