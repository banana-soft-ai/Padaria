-- Views passam a usar permissões do usuário que consulta (RLS respeitado).
-- Corrige alerta Supabase: "View defined with SECURITY DEFINER".
-- Reversão: ALTER VIEW public.<nome> SET (security_invoker = false);

ALTER VIEW public.vendas_hoje SET (security_invoker = true);
ALTER VIEW public.produtos_estoque_baixo SET (security_invoker = true);
ALTER VIEW public.resumo_caixa_hoje SET (security_invoker = true);
