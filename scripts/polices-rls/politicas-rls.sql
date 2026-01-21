-- =====================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY) - UNIFICADO
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE receita_ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE caderneta ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos_fixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_caderneta ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_caderneta ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE fluxo_caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE precos_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE composicao_receitas ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS GERAIS PARA USUÁRIOS AUTENTICADOS
-- =====================================================

-- Usuarios
CREATE POLICY "Usuários podem ver todos os dados" 
ON usuarios FOR SELECT USING (auth.role() = 'authenticated');

-- Insumos
CREATE POLICY "Usuários podem inserir dados" 
ON insumos FOR ALL USING (auth.role() = 'authenticated');

-- Receitas
CREATE POLICY "Usuários podem inserir dados" 
ON receitas FOR ALL USING (auth.role() = 'authenticated');

-- Receita Ingredientes
CREATE POLICY "Usuários podem inserir dados" 
ON receita_ingredientes FOR ALL USING (auth.role() = 'authenticated');

-- Produtos
CREATE POLICY "Usuários podem inserir dados" 
ON produtos FOR ALL USING (auth.role() = 'authenticated');

-- Clientes
CREATE POLICY "Usuários podem inserir dados" 
ON clientes FOR ALL USING (auth.role() = 'authenticated');

-- Caixas
CREATE POLICY "Usuários podem inserir dados" 
ON caixas FOR ALL USING (auth.role() = 'authenticated');

-- Vendas
CREATE POLICY "Usuários podem inserir dados" 
ON vendas FOR ALL USING (auth.role() = 'authenticated');

-- Venda Itens
CREATE POLICY "Usuários podem inserir dados" 
ON venda_itens FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem ver itens de venda" 
ON venda_itens FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem inserir itens de venda" 
ON venda_itens FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem atualizar itens de venda" 
ON venda_itens FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem deletar itens de venda" 
ON venda_itens FOR DELETE USING (auth.role() = 'authenticated');

-- Caderneta
CREATE POLICY "Usuários podem inserir dados" 
ON caderneta FOR ALL USING (auth.role() = 'authenticated');

-- Estoque Movimentações
CREATE POLICY "Usuários podem inserir dados" 
ON estoque_movimentacoes FOR ALL USING (auth.role() = 'authenticated');

-- Custos Fixos
CREATE POLICY "Usuários podem inserir dados" 
ON custos_fixos FOR ALL USING (auth.role() = 'authenticated');

-- Lançamentos Fiscais removidos (módulo fiscal eliminado)

-- Logs Sistema
CREATE POLICY "Usuários podem inserir dados" 
ON logs_sistema FOR ALL USING (auth.role() = 'authenticated');

-- Clientes Caderneta
CREATE POLICY "Usuários podem ver todos os clientes caderneta" 
ON clientes_caderneta FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem inserir clientes caderneta" 
ON clientes_caderneta FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem atualizar clientes caderneta" 
ON clientes_caderneta FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem deletar clientes caderneta" 
ON clientes_caderneta FOR DELETE USING (auth.role() = 'authenticated');

-- Movimentações Caderneta
CREATE POLICY "Usuários podem ver movimentações da caderneta" 
ON movimentacoes_caderneta FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem inserir movimentações da caderneta" 
ON movimentacoes_caderneta FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem atualizar movimentações da caderneta" 
ON movimentacoes_caderneta FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem deletar movimentações da caderneta" 
ON movimentacoes_caderneta FOR DELETE USING (auth.role() = 'authenticated');

-- Caixa Diário
CREATE POLICY "Usuários podem ver caixa diário" 
ON caixa_diario FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem inserir caixa diário" 
ON caixa_diario FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem atualizar caixa diário" 
ON caixa_diario FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem deletar caixa diário" 
ON caixa_diario FOR DELETE USING (auth.role() = 'authenticated');

-- Fluxo de Caixa
CREATE POLICY "Usuários podem ver fluxo de caixa" 
ON fluxo_caixa FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem inserir fluxo de caixa" 
ON fluxo_caixa FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem atualizar fluxo de caixa" 
ON fluxo_caixa FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem deletar fluxo de caixa" 
ON fluxo_caixa FOR DELETE USING (auth.role() = 'authenticated');

-- Preços Venda
CREATE POLICY "Usuários podem ver preços de venda" 
ON precos_venda FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem inserir preços de venda" 
ON precos_venda FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem atualizar preços de venda" 
ON precos_venda FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem deletar preços de venda" 
ON precos_venda FOR DELETE USING (auth.role() = 'authenticated');

-- Composição Receitas
CREATE POLICY "Usuários podem inserir/atualizar/composicao_receitas" 
ON composicao_receitas FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Arquivo movido para scripts/sql/policies/politicas-rls.sql
