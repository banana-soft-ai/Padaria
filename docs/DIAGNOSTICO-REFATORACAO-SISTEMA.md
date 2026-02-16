# Diagnóstico de refatoração do sistema

Data: 2026-02-16

## Como o diagnóstico foi feito

- Execução de lint para levantar riscos de efeitos colaterais e acoplamento em componentes React.
- Execução de typecheck para identificar quebras de contrato entre camadas.
- Levantamento de arquivos mais extensos para mapear pontos de alta complexidade.

## Principais pontos que precisam de refatoração

### 1) Página de caixa com complexidade crítica

- O arquivo `src/app/caixa/page.tsx` possui **5176 linhas**.
- Também concentra o maior volume de avisos de hooks (`react-hooks/exhaustive-deps`).
- Sinaliza responsabilidades misturadas no mesmo módulo: carregamento de dados, regras de negócio, teclado/atalhos, estado de modais e renderização.

**Refatoração sugerida**

- Extrair fluxo em módulos por contexto:
  - `useCaixaData` (queries e sincronização)
  - `useCaixaVenda` (carrinho, inclusão/remoção, cálculo)
  - `useCaixaFechamento` (validações e fechamento)
  - `useCaixaHotkeys` (atalhos e handlers)
- Mover componentes de modal para contêiner dedicado e receber apenas props de domínio.
- Reduzir side effects implícitos com `useCallback`/`useMemo` e dependências explícitas.

### 2) Débito técnico em efeitos React (26 warnings)

- Existem **26 warnings de lint**, quase todos de dependências ausentes em hooks.
- Esse padrão pode gerar stale state, re-renderização inesperada e bugs intermitentes.

**Refatoração sugerida**

- Padronizar regra: funções usadas em `useEffect` devem ser memoizadas (`useCallback`) ou movidas para escopo externo quando puras.
- Criar guideline de hooks no projeto e checklist de PR para validar dependências.
- Prioridade imediata para:
  - `src/app/caixa/page.tsx`
  - `src/app/gestao/saidas/page.tsx`
  - `src/components/caderneta/CadernetaContent.tsx`

### 3) Contratos quebrados entre services e repositories (typecheck falhando)

- O typecheck falha por incompatibilidade entre `vendas.service.ts` e `vendas.repository` (exports ausentes como `insertVenda` e `insertVendaItens`).
- Há falhas adicionais em fixtures/testes por divergência de tipos (`created_at`, `updated_at`) e assinatura de mocks.

**Refatoração sugerida**

- Definir contrato explícito da camada de repositório (interface + testes de contrato).
- Revisar `src/services/vendas.service.ts` para consumir somente API pública vigente do repositório.
- Sincronizar tipos de fixtures com schema atual e atualizar helpers de mock.

### 4) Concentração de lógica em páginas grandes (manutenibilidade baixa)

Arquivos com alto tamanho e potencial alto de regressão:

- `src/components/caderneta/CadernetaContent.tsx` (1617)
- `src/app/receitas/page.tsx` (1524)
- `src/app/gestao/precos/page.tsx` (1013)
- `src/app/gestao/estoque/page.tsx` (959)
- `src/app/gestao/operadores/page.tsx` (821)

**Refatoração sugerida**

- Aplicar padrão “container + componentes de apresentação”.
- Extrair lógica de estado para hooks focados por domínio.
- Quebrar regras de negócio em serviços puros testáveis.

## Priorização recomendada (ordem de execução)

1. **Estabilização técnica (alta urgência)**
   - Corrigir erros de typecheck e contratos `service ↔ repository`.
2. **Confiabilidade de hooks (alta urgência)**
   - Resolver warnings críticos de `useEffect`/`useCallback` começando por caixa.
3. **Modularização da página de caixa (alto impacto)**
   - Reduzir arquivo e separar responsabilidades em hooks/containers.
4. **Modularização progressiva das demais páginas grandes (médio impacto)**
   - Caderneta, receitas, preços, estoque e operadores.
5. **Padronização arquitetural (sustentação)**
   - Definir convenções de tamanho máximo de arquivo, checklist de hooks e contratos de camadas.

## Critérios de pronto para a refatoração

- `npm run typecheck` sem erros.
- `npm run lint` sem warnings de hooks nas áreas refatoradas.
- Arquivos críticos com queda de tamanho e cobertura de testes para regras extraídas.
- PRs menores e orientados por domínio (evitar “mega PR”).
