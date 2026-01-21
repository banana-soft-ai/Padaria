-- Adiciona preco_pacote e peso_pacote na tabela varejo
ALTER TABLE varejo ADD COLUMN preco_pacote numeric(12,2);
ALTER TABLE varejo ADD COLUMN peso_pacote numeric(12,3);