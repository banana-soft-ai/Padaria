# Plano de refatoração (apenas refatoração)

Documento que descreve **apenas** o que refatorar no Rey dos Pães, na ordem sugerida. Não inclui modularização por domínio nem feature flags — isso pode ser tratado em outro momento.

---

## Escopo

- **Incluído:** caixa como única fonte da verdade, uma porta para dados (repositories/services), correção de hooks, quebra do monolito do PDV, sync/offline mais claro, tipagem e testes.
- **Fora do escopo (por enquanto):** modularização por domínio (`modules/caixa`, `api.ts`, etc.), feature flags e multi-tenant.

Estrutura de pastas permanece: `src/repositories/`, `src/services/`, `src/hooks/`, `src/components/`, etc.

---

## Ordem sugerida

### 1. Caixa: uma única fonte da verdade

**Problema:** “Caixa aberto” e “carregar caixa do dia” duplicados em SistemaCaixa, useCaixa, CadernetaContent, AbrirCaixaModal, useCadernetaOffline, página do caixa, gestão.

**O que fazer:**

- Criar `caixaDiarioRepository` e `caixaService` em `src/repositories/` e `src/services/`.
- Centralizar: obter caixa aberto (e corrigir múltiplos abertos), abrir caixa, fechar caixa, atualizar totais.
- Migrar **uma tela por vez**: primeiro `useCaixa` e `SistemaCaixa`, depois Caderneta, operadores, gestão, por último o PDV.
- Caderneta, operadores, gestão e PDV passam a perguntar “caixa aberto?” só via service/repository (ex.: `useCaixa().caixaHoje`).

**Arquivos:** novo `caixaDiario.repository.ts`, novo `caixa.service.ts`; alterar `useCaixa.ts`, `SistemaCaixa.tsx`, `CadernetaContent.tsx`, `AbrirCaixaModal.tsx`, `useCadernetaOffline.ts`, `app/caixa/page.tsx`, gestão de caixas.

---

### 2. useCadernetaOffline: corrigir violação dos Hooks

**Problema:** Dentro do callback assíncrono de `registrarPagamento` (branch offline) há chamadas a `useOfflineData`. Hooks não podem ser chamados dentro de callbacks/async.

**O que fazer:**

- Chamar `useOfflineData` **só no topo** do hook, com as tabelas necessárias (`caixa_diario`, `caixa_movimentacoes`, `fluxo_caixa`).
- Em `registrarPagamento`, usar as **funções e dados** já obtidos no topo; não chamar `useOfflineData` dentro do callback.

**Arquivos:** `src/hooks/useCadernetaOffline.ts`.

---

### 3. PDV: quebrar o monolito da página

**Problema:** `src/app/caixa/page.tsx` com milhares de linhas; qualquer mudança é arriscada.

**O que fazer:**

- Extrair **parsers** (`parseEan13Balanca`, `parseEtiqueta11Digitos`) para `src/lib/barcodeBalanca.ts` (ou similar) e adicionar testes unitários.
- Extrair **lógica de negócio** para services/repositories (registrar venda, sangria, buscar vendas do caixa).
- Extrair **componentes** por fluxo: barra de busca, carrinho, totais, pagamento, caderneta no PDV.
- Manter na página só **orquestração de UI** e uso de hooks que chamam os services.

**Arquivos:** novo `lib/barcodeBalanca.ts`, novos ou existentes services/repositories de vendas/caixa; novos componentes em `components/caixa/`; `app/caixa/page.tsx` enxuta.

---

### 4. Uma única porta para dados

**Problema:** Vários pontos usam `supabase.from(...)` direto em hooks e páginas.

**O que fazer:**

- Criar repositories onde faltam: caderneta, fluxo de caixa, e outros que ainda acessem Supabase direto (ex.: receitas, insumos, composições, gestão de preços/operadores).
- Substituir chamadas diretas por uso de repositories (e services quando houver regra de negócio).
- Se `dateUtils` fizer query em `caixa_diario`, mover essa lógica para um service que use o repositório de caixa; `dateUtils` deve ser só funções puras de data.

**Arquivos:** novos/ajustes em `repositories/`, `services/`; alterar hooks e páginas que hoje usam `supabase.from()`.

---

### 5. Hooks e Caderneta na UI

**Problema:** Hooks como useVendas/useCaixa fazem tudo (Supabase + offline + estado); CadernetaContent usa Supabase direto para “caixa aberto” e concentra muita lógica.

**O que fazer:**

- Hooks de UI só **orquestram**; regras e dados vêm de **services** (que decidem online/offline e usam repositories).
- Unificar duplicação entre `useCaixa` e `SistemaCaixa` em um único `useCaixa` consumido por todos.
- Caderneta: “caixa aberto?” via `useCaixa().caixaHoje`; extrair subcomponentes/hooks (cliente selecionado, modal de pagamento) para reduzir tamanho de `CadernetaContent`.

**Arquivos:** `useCaixa.ts`, `useVendas` (e similares), `SistemaCaixa.tsx`, `CadernetaContent.tsx` e componentes extraídos.

---

### 6. Sync e offline

**Problema:** Lógica de sync e “o que fazer quando volta online” espalhada; regras específicas (ex.: não duplicar `caixa_diario`) em lógica hardcoded no syncService.

**O que fazer:**

- Ter uma **camada clara** de escrita offline (repositório que abstrai gravar no IndexedDB e enfileirar para sync).
- Centralizar regras de conflito e exceções em **um** módulo de sync (handlers por tabela ou entidade).
- Garantir que **syncService** não dependa de hooks (não importar `useOnlineStatus` dentro do service).

**Arquivos:** `lib/offlineStorage`, `syncService`, handlers de sync; documentação em `docs/offline/` se existir.

---

### 7. Tipagem e testes

**Problema:** Uso de `any` em vários pontos; poucos testes nas partes sensíveis (caixa, vendas, caderneta, PDV).

**O que fazer:**

- Reduzir `any`: tipar parâmetros e retornos com tipos do domínio (`src/types/`).
- Unificar converters em um único módulo; garantir que todos usem o mesmo formato.
- Ao extrair services/repositories, escrever **testes unitários** (com mocks do Supabase/offline).
- Testes para **funções puras** extraídas (parsers de código de barras).

**Arquivos:** `src/types/`, converters, novos testes em `**/*.test.ts` / `**/*.spec.ts`.

---

## Riscos e observações

- Migrar tudo para repositories/services exige mudar muitas importações; fazer **por domínio/tela** reduz risco.
- Qualquer mudança em caixa/caderneta/vendas impacta IndexedDB e sync — validar fluxo offline após cada etapa.
- A página do caixa é crítica: refatorar em etapas (parsers → services → componentes) e testar manualmente o fluxo completo.

---

## Referência

- Contexto do projeto: `.cursor/skills/project-context/`
- Documento completo (refatoração + modularização + feature flags): `docs/REFATORACAO-MODULARIZACAO-E-FEATURE-FLAGS.md`
