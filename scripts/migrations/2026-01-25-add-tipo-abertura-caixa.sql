-- Adiciona coluna tipo_abertura para rastrear se é primeira vez ou troca de turno
ALTER TABLE caixa_diario ADD COLUMN tipo_abertura VARCHAR(20);
-- Opcional: preenche valores existentes como 'primeira' para registros antigos
UPDATE caixa_diario SET tipo_abertura = 'primeira' WHERE tipo_abertura IS NULL;