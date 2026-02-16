# Refatoração, modularização e feature flags — Resumo da conversa

Documento que consolida tudo o que foi discutido sobre: por que o sistema quebra fácil ao mudar uma coisa, o que refatorar, como modularizar por domínio e como usar feature flags para vários clientes (multi-tenant / white-label).

---

## Parte 1 — Por que o sistema quebra fácil e o que refatorar

### Diagnóstico

- O projeto define **services + repositories** como camada de dados, mas a maior parte do código usa **Supabase direto** em páginas, componentes e hooks.
- Há **lógica duplicada** (especialmente em torno de caixa e vendas), **um arquivo gigante** (PDV), **violação das regras do React** (hooks dentro de callbacks) e **pouca cobertura de testes** nas partes mais sensíveis.
- Isso gera acoplamento e efeitos colaterais: ao corrigir um ponto, outro quebra.

### 1. Arquitetura de dados: uma única porta para o Supabase

**Problema:** Dezenas de arquivos chamam `supabase.from(...)` direto. Qualquer mudança de schema, RLS ou política exige caça em muitos arquivos.

**O que fazer:**

- **Sempre** acessar dados via **repositories** (e, quando houver regra de negócio, via **services**). Páginas, componentes e hooks **não** importam `supabase` para ler/escrever tabelas.
- Criar repositórios para as entidades que hoje são acessadas direto:
  - `caixaDiarioRepository` (abrir/fechar, buscar aberto, atualizar totais)
  - Ampliar uso de `vendas.repository` e remover chamadas diretas
  - `cadernetaRepository` / `fluxoCaixaRepository` onde fizer sentido
- **`dateUtils`** hoje faz query em `caixa_diario`. Mover essa lógica para um **service**; `dateUtils` deve ser só funções puras de data.

**Benefício:** Um único lugar por entidade para mudar queries e regras.

---

### 2. Caixa: uma única fonte da verdade

**Problema:** A noção de “caixa aberto” e “carregar caixa do dia” está **duplicada** em:

- `SistemaCaixa.tsx` (`carregarCaixaHoje` + lógica de múltiplos caixas abertos + totais)
- `useCaixa.ts` (quase a mesma lógica)
- `CadernetaContent.tsx` (`verificarCaixaAberto` com query própria)
- `AbrirCaixaModal.tsx`, `useCadernetaOffline.ts`, `app/caixa/page.tsx`, `CaixasTab.tsx`, `gestao/caixas/page.tsx`, etc.

**O que fazer:**

- Centralizar em **um** repositório + **um** service de caixa:
  - “Obter caixa aberto (e corrigir múltiplos abertos)”
  - “Abrir caixa”
  - “Fechar caixa”
  - “Atualizar totais do caixa”
- **SistemaCaixa** e **useCaixa** passam a usar **só** esse service (e um único hook, ex. `useCaixa`).
- Caderneta, operadores, gestão e PDV **só** perguntam “caixa aberto?” via service/repository.

**Benefício:** Uma única implementação para regras de caixa.

---

### 3. Página do caixa (PDV): quebrar o monolito

**Problema:** `src/app/caixa/page.tsx` tem **milhares de linhas** (código de barras, vendas, abertura/fechamento, sangria, caderneta, offline, toasts, etc.). Qualquer mudança ali é arriscada.

**O que fazer:**

- Extrair **lógica de negócio** para **services** e **repositories** (ex.: registrar venda, sangria, buscar vendas do caixa).
- Manter na página só **orquestração de UI** e uso de hooks que chamam os services.
- Extrair **componentes** por fluxo (barra de busca, carrinho, totais, pagamento, caderneta no PDV).
- Mover **funções puras** (ex.: `parseEan13Balanca`, `parseEtiqueta11Digitos`) para `lib/` (ex.: `lib/barcodeBalanca.ts`) e testar com unitários.

**Benefício:** Menos risco ao alterar uma feature; testes unitários em services e parsers.

---

### 4. Hooks que chamam Supabase e offline juntos

**Problema:** Hooks como `useVendas` e `useCaixa` fazem **tudo**: chamada ao Supabase, cache offline, tratamento de `isOnline`, vários `useState`. São grandes e difíceis de manter.

**O que fazer:**

- Hooks de UI só **orquestram**; chamam **services** (que decidem online/offline e usam repositories + `offlineStorage`/sync).
- Reduzir duplicação entre `useCaixa` e `SistemaCaixa` usando **um único** hook `useCaixa` e fazendo `SistemaCaixa` só consumir esse hook.

**Benefício:** Regras de dados e sync em um lugar; hooks mais simples.

---

### 5. Violação das regras dos Hooks (useCadernetaOffline)

**Problema:** Em `useCadernetaOffline.ts`, dentro da função assíncrona (branch offline de `registrarPagamento`), há chamadas a **`useOfflineData`** (linhas 319, 331, 333, 342). Hooks não podem ser chamados dentro de callbacks/async; isso viola as regras do React.

**O que fazer:**

- Chamar `useOfflineData` **só no topo** do hook, com as tabelas necessárias.
- Em `registrarPagamento`, usar as **funções** e **dados** já obtidos desses hooks, não chamar `useOfflineData` de novo dentro do callback.

**Benefício:** Comportamento previsível e alinhado com o React.

---

### 6. Caderneta e caixa na UI

**Problema:** `CadernetaContent` usa Supabase direto para “caixa aberto” e concentra muita lógica e estado.

**O que fazer:**

- “Caixa aberto?” vir de **service/hook único** (ex.: `useCaixa().caixaHoje`).
- Extrair **subcomponentes** e hooks (ex.: cliente selecionado, modal de pagamento) para reduzir o tamanho de `CadernetaContent`.

---

### 7. Tipagem e converters

**Problema:** Uso de `any` em vários pontos e possivelmente dois formatos (converters.ts e .cjs).

**O que fazer:**

- Reduzir `any`: tipar parâmetros e retornos com tipos do domínio.
- Unificar em um único módulo de converters; garantir que quem chama use sempre o mesmo formato.

---

### 8. Sync e offline

**Problema:** Lógica de sync e “o que fazer quando volta online” está espalhada; regras específicas (ex.: não criar `caixa_diario` duplicado) estão dentro do `syncService` com lógica hardcoded.

**O que fazer:**

- Ter uma **camada clara** de “escrita offline” (repositório que abstrai gravar no IndexedDB e enfileirar para sync).
- Centralizar regras de conflito e exceções em **um** módulo de sync (handlers por tabela ou entidade).
- Garantir que **syncService** não dependa de hooks (não importar `useOnlineStatus` dentro do service).

---

### 9. Testes nas partes que mais quebram

**Problema:** Poucos testes; a maior parte cobre libs. A página do caixa e os services que orquestram vendas/caixa/caderneta quase não têm cobertura.

**O que fazer:**

- Ao extrair **services** e **repositories** de caixa e vendas, escrever **testes unitários** para eles (com mocks do Supabase/offline).
- Testes para **funções puras** extraídas (ex.: parsers de código de barras).
- Manter/ampliar testes dos hooks após a refatoração.

---

### 10. Ordem sugerida (para não quebrar tudo de uma vez)

1. **Caixa:** criar `caixaDiarioRepository` + `caixaService`, migrar **uma** tela por vez (ex.: primeiro `useCaixa` e `SistemaCaixa`) para usar só esse service; depois Caderneta, operadores, gestão, por último o PDV.
2. **useCadernetaOffline:** corrigir uso de hooks (chamar só no topo; não chamar `useOfflineData` dentro de `registrarPagamento`).
3. **PDV:** extrair parsers e depois services/repositories; em seguida fatiar a página em componentes.
4. **Repositories** para caderneta e fluxo de caixa; substituir chamadas diretas ao Supabase.
5. **dateUtils:** tirar a query de `caixa_diario` e mover para um service que use o novo repositório de caixa.
6. **Tipagem e testes:** ir reduzindo `any` e adicionando testes nos novos services/repositories.

---

## Parte 2 — Modularização por domínio

### Ideia

- Organizar por **domínio** (caixa, vendas, caderneta, estoque, etc.), não só por tipo técnico (components, hooks, services).
- Cada domínio vira um **módulo** com **API pública** bem definida; o resto do app **só usa essa API**, não importa arquivos internos.

### Módulos sugeridos

| Módulo      | Responsabilidade                                      | O que expõe (API pública)                                      |
|------------|--------------------------------------------------------|------------------------------------------------------------------|
| **caixa**  | Caixa diário: abertura, fechamento, totais, sangria    | `useCaixa()`, `getCaixaAberto()`, talvez `<CaixaProvider>`       |
| **vendas** | Registrar venda, itens, formas de pagamento, listar    | `useVendas()`, `registrarVenda()`, tipos `Venda`, `ItemVenda`    |
| **caderneta** | Clientes fiado, saldo, movimentações, pagamentos   | `useCadernetaOffline()` ou `useCaderneta()`, funções de pagamento |
| **estoque** | Insumos, varejo, movimentações                       | Repo/service + hook(s)                                          |
| **receitas** | Receitas, composições, insumos da receita           | Hooks atuais em pasta única + API pública                        |
| **precos** | Preços de venda, margem, custo                        | Service + hook                                                  |
| **sync/offline** | IndexedDB, fila de sync, online/offline            | `offlineStorage`, `syncService`, `useOnlineStatus`               |

### Estrutura de pastas (exemplo)

```
src/
  modules/
    caixa/
      api.ts              # só exports públicos: useCaixa, getCaixaAberto, tipos
      caixaService.ts
      caixaRepository.ts
      useCaixa.ts
      components/         # opcional: CaixaStatus, ModalAbertura, etc.
    vendas/
      api.ts
      vendas.repository.ts
      vendasService.ts
      useVendas.ts
    caderneta/
      api.ts
      ...
    estoque/
      api.ts
      ...
  app/                    # páginas só importam de modules/*/api
  components/             # componentes globais (layout, sidebar)
  lib/                    # shared: dateUtils, formatadores, supabase client, sync
```

**Regra:** fora do módulo, ninguém importa `caixaRepository.ts` ou `useCadernetaOffline.ts` direto; importa só `@/modules/caixa/api` ou `@/modules/caderneta/api`.

### Ordem sugerida para modularizar

1. Definir a **API** de cada módulo (em `api.ts`): quais hooks e funções são públicos.
2. Começar por **caixa** (muita duplicação e acoplamento).
3. Criar `modules/caixa/` com repository, service, `useCaixa`, e `api.ts`; migrar `SistemaCaixa`, CadernetaContent, AbrirCaixaModal, etc., para importar só de `@/modules/caixa/api`.
4. Repetir para **vendas** e **caderneta**, depois estoque/receitas/precos.
5. **Sync** como módulo compartilhado; os outros só usam “salvar offline” / “enfileirar” via interface estável.

---

## Parte 3 — Feature flags para vários clientes (multi-tenant / white-label)

Cenário: vender o mesmo produto (site/app) em escala para muitos clientes; alguns querem estoque, outros não; alguns querem caderneta, outros não, etc.

### Opções de implementação

#### 1. Feature flags por tenant (recomendado para escala)

- Cada **cliente** (tenant) tem um identificador (ex.: `tenant_id` ou domínio).
- As **features** são ligadas/desligadas **por tenant** em um único lugar (banco ou config).

**Onde guardar as flags:**

- **Banco (Supabase):** tabela `tenant_config` ou `tenants` com colunas como:
  - `id`, `nome`, `slug` (ou subdomínio)
  - `features` (JSONB): `{ "estoque": true, "caderneta": true, "receitas_avancado": false }`
- Ou tabela `feature_flags`: `tenant_id`, `feature_key`, `enabled` (boolean).

**No app:**

- No **login** ou no **layout** (por sessão/tenant), buscar as flags do tenant atual.
- Colocar as flags em **contexto React** (ex.: `FeatureFlagsProvider`) ou em variáveis de ambiente **por deploy** (se cada cliente tiver um deploy separado).

**Uso na UI:**

- Antes de mostrar menu “Estoque” ou página de estoque: `if (features.estoque) { ... }`.
- Rotas podem ser condicionais: só registrar `/estoque` se `features.estoque` for true.
- No backend (RLS, API): as mesmas flags podem ser usadas para esconder dados ou desativar endpoints.

**Vantagem:** Um único código; você liga/desliga features por cliente sem novo deploy. Escala bem para 100+ clientes.

#### 2. Variáveis de ambiente por deploy

- Cada cliente tem seu próprio deploy (Vercel/Railway) com `NEXT_PUBLIC_FEATURE_ESTOQUE=true` ou `false`.
- O build já sai com as features certas para aquele cliente.

**Vantagem:** Simples. **Desvantagem:** 100 clientes = 100 deploys e 100 builds; mudar uma flag exige novo deploy.

#### 3. Híbrido (recomendado para “100 sites em 2 semanas”)

- **Tenant no banco:** cada cliente tem `tenant_id`; usuários e dados são filtrados por tenant (RLS).
- **Flags no banco por tenant:** tabela `tenant_config` com `features` (JSONB). Um job ou tela admin preenche isso ao criar o cliente.
- **App único (multi-tenant):** um único deploy; o domínio ou o login identifica o tenant; o app carrega as flags daquele tenant (na sessão ou em contexto).
- **Build único:** todas as features existem no código; a UI e as rotas só aparecem ou são acessíveis se `features.estoque === true` (ou equivalente).

Assim você vende “100 sites” na verdade como **100 tenants** no mesmo app, com feature flags por tenant.

### Exemplo mínimo de estrutura (Supabase)

```sql
-- Exemplo (ajustar ao schema existente)
create table tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  features jsonb not null default '{}'
  -- ex.: { "estoque": true, "caderneta": true, "receitas_avancado": false }
);

-- Em usuários ou sessão, guardar tenant_id para saber qual config usar.
```

No app (ex.: React):

```ts
// Exemplo de uso
const { features } = useTenant() // ou useFeatureFlags()
if (features?.estoque) {
  // mostrar menu Estoque, rotas /estoque, etc.
}
```

### Resumo para “100 clientes em 2 semanas”

- Usar **um app multi-tenant** com **feature flags por tenant** no banco.
- Cadastro de novo cliente = criar linha em `tenants` com `features` desejado.
- Código: sempre checar `features.estoque`, `features.caderneta`, etc., para mostrar/esconder módulos e rotas.
- Assim você não mantém 100 codebases nem 100 deploys; um único código e um único pipeline, com comportamento por cliente controlado por dados (flags).

---

## Resumo final

| Tema            | Ação principal                                                                 |
|-----------------|---------------------------------------------------------------------------------|
| **Refatoração** | Uma porta para dados (repositories/services); uma fonte da verdade para caixa; quebrar o monolito do PDV; corrigir hooks; centralizar sync; mais testes. |
| **Modularização** | Módulos por domínio (`modules/caixa`, `vendas`, `caderneta`, etc.) com API pública (`api.ts`); resto do app só usa a API. |
| **Feature flags** | Flags por tenant no banco (`tenants.features`); app único multi-tenant; UI e rotas condicionais às flags; escala para muitos clientes sem um deploy por cliente. |

---

*Documento gerado a partir da conversa sobre refatoração, modularização e feature flags no projeto Rey dos Pães.*
