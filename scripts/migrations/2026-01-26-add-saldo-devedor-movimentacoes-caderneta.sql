-- Migration: Adiciona campo saldo_devedor em movimentacoes_caderneta
-- Data: 2026-01-26

ALTER TABLE movimentacoes_caderneta
ADD COLUMN saldo_devedor DECIMAL(10,2);

-- Atualiza saldo_devedor com base no saldo_devedor do cliente no momento da movimentação
UPDATE movimentacoes_caderneta mc
SET saldo_devedor = cc.saldo_devedor
FROM clientes_caderneta cc
WHERE mc.cliente_id = cc.id;

-- Opcional: para futuras inserções, recomenda-se usar trigger para manter saldo_devedor atualizado
