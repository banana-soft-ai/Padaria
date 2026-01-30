-- Permite o mesmo insumo em categorias diferentes (massa, cobertura, embalagem)
-- na mesma receita. Ex: açúcar na massa + açúcar na cobertura.

ALTER TABLE composicao_receitas
DROP CONSTRAINT IF EXISTS composicao_receitas_receita_id_insumo_id_key;

ALTER TABLE composicao_receitas
ADD CONSTRAINT composicao_receitas_receita_insumo_categoria_unique
UNIQUE (receita_id, insumo_id, categoria);
