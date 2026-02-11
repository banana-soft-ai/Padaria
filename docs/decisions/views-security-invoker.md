# Decisão: Views com security_invoker

**Data:** 2026-02-11

## Motivo

O Supabase (Advisor/Security) apontou que as views `vendas_hoje`, `produtos_estoque_baixo` e `resumo_caixa_hoje` tinham comportamento equivalente a **SECURITY DEFINER**: o acesso às tabelas base era verificado com as permissões do **dono da view**, e não do usuário que consulta. Isso fazia com que o RLS (Row Level Security) das tabelas subjacentes não fosse aplicado ao consultar a view.

## Solução adotada

As três views passaram a ser criadas e alteradas com **`security_invoker = true`**:

- O acesso às tabelas base (vendas, caixas, produtos, clientes, usuarios, etc.) passa a ser verificado com as **permissões do usuário que executa a query**.
- O RLS das tabelas base é aplicado normalmente ao consultar a view.

## Exigência

- **PostgreSQL 15+** (recurso `security_invoker` em views). O Supabase atende.

## Referências

- **Migration (ambientes existentes):** `scripts/migrations/2026-02-11-views-security-invoker.sql`
- **Scripts de criação (novos ambientes):** `scripts/views-uteis/views-uteis.sql` e `scripts/setup-database/setup-database.sql` (seção VIEWS ÚTEIS)

## Reversão

Em caso de necessidade de voltar ao comportamento anterior:

```sql
ALTER VIEW public.vendas_hoje SET (security_invoker = false);
ALTER VIEW public.produtos_estoque_baixo SET (security_invoker = false);
ALTER VIEW public.resumo_caixa_hoje SET (security_invoker = false);
```

## Checklist de revisão (agente-seguranca)

Para validar a alteração, o agente de segurança pode conferir:

- [ ] **RLS:** As tabelas base (vendas, caixas, produtos, clientes, usuarios) continuam com RLS ativo; as políticas aplicam-se ao consultar as views com security_invoker.
- [ ] **Dados sensíveis:** vendas_hoje e resumo_caixa_hoje expõem apenas dados já acessíveis pelas tabelas base conforme RLS; nenhum vazamento adicional.
- [ ] **Conformidade Supabase:** Após aplicar a migration em homologação, o Advisor/Security do Supabase não deve mais reportar "View defined with SECURITY DEFINER" para essas três views.
- [ ] **Documentação:** Decisão registrada neste arquivo; scripts e setup referenciados; reversão documentada.
