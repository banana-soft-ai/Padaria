# Agente de Segurança — Referência

## Checklist: Autenticação

- [ ] RouteGuard/AuthGuard verificam sessão antes de renderizar rotas sensíveis
- [ ] Desbloqueio admin não bypassa RLS; apenas eleva contexto onde permitido
- [ ] Offline: validação por hash (ex.: crypto.subtle); nenhuma senha em texto plano
- [ ] Tokens/sessão não persistidos em localStorage em formato legível sensível

## Checklist: RLS

- [ ] Toda tabela de negócio tem RLS habilitado
- [ ] Policies usam `auth.uid()` e/ou role do JWT de forma consistente
- [ ] SELECT/INSERT/UPDATE/DELETE restritos por perfil (admin, gerente, funcionario, caixa)
- [ ] Nenhuma policy com `USING (true)` em produção para dados sensíveis
- [ ] Acessos por perfil documentados (ex.: `docs/setup/rls-perfis.md`)

## Checklist: Dados Sensíveis

- [ ] Caderneta (fiado, limite, saldo): apenas roles autorizadas
- [ ] Vendas e itens: operador_id ou gestores
- [ ] Caixa: abertura/fechamento auditáveis e restritos
- [ ] Logs e respostas de API sem dados sensíveis (CPF, saldos completos quando não necessário)

## Checklist: Secrets e Environments

- [ ] Nenhuma chave sensível com prefixo `NEXT_PUBLIC_`
- [ ] JWT_SECRET e segredos de API apenas em server/env de deploy
- [ ] CI/CD: secrets em GitHub Secrets (ou equivalente); não no YAML em claro
- [ ] Documentação em `docs/setup/` indica onde cada variável é usada (sem valores)

## Checklist: Novo Módulo / Nova Tabela

- [ ] Tabelas novas com RLS desde o design
- [ ] Roles mapeadas: quem pode SELECT/INSERT/UPDATE/DELETE
- [ ] API routes verificam auth e role antes de chamar service
- [ ] Decisão de permissões registrada em `docs/decisions/`

## Checklist: Deploy

- [ ] Variáveis de produção não expostas no repositório
- [ ] RLS ativo em produção
- [ ] Sem endpoints de debug ou dados sensíveis em respostas genéricas

## Documentação

- **Decisões de segurança**: `docs/decisions/` (ex.: `docs/decisions/seguranca-auth-offline.md`)
- **Setup e RLS**: `docs/setup/` (ex.: variáveis de ambiente, perfis RLS)
- **Checklists por fase**: podem ser copiados deste reference para uso em tarefas

## Integração com Master-Agent

Na tabela de delegação, Segurança aparece como **revisão**:

| Tipo de Tarefa | Agente | Observação |
|----------------|--------|------------|
| Nova política RLS ou alteração de roles | Backend implementa; **Segurança** revisa | |
| Nova variável de ambiente ou secret no pipeline | CI/CD ou responsável implementa; **Segurança** checa exposição | |
| Novo módulo com permissões (fiscal, pagamentos) | Master planeja; Backend implementa; **Segurança** avalia design e revisa | |
| Auth offline ou RouteGuard/AuthGuard | Backend/Frontend implementam; **Segurança** revisa fluxo e armazenamento | |

## Métricas de Sucesso (orientação)

- Zero vazamentos de dados sensíveis em produção
- Conformidade das políticas com os perfis definidos
- Redução de vulnerabilidades a cada ciclo (revisões preventivas)
