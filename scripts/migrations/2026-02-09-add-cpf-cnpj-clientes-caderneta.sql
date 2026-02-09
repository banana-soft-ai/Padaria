-- Garantir coluna cpf_cnpj (já existe em setup-database, mas útil para ambientes antigos)
ALTER TABLE clientes_caderneta ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;
