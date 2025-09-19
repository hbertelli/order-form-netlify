/*
  # Adicionar campos schema e view_name à tabela order_sessions

  1. Alterações na Tabela
    - Adicionar coluna `schema` (text) com valor padrão 'demo'
    - Adicionar coluna `view_name` (text) com valor padrão 'v_last_order_by_product_atacamax'

  2. Segurança
    - Manter RLS existente
    - Não alterar políticas de segurança

  3. Observações
    - Campos opcionais para manter compatibilidade com código existente
    - Valores padrão garantem funcionamento sem quebrar fluxos atuais
*/

-- Adicionar colunas para schema e view_name na tabela order_sessions
DO $$
BEGIN
  -- Adicionar coluna schema se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo' 
    AND table_name = 'order_sessions' 
    AND column_name = 'schema'
  ) THEN
    ALTER TABLE demo.order_sessions 
    ADD COLUMN schema text DEFAULT 'demo';
  END IF;

  -- Adicionar coluna view_name se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo' 
    AND table_name = 'order_sessions' 
    AND column_name = 'view_name'
  ) THEN
    ALTER TABLE demo.order_sessions 
    ADD COLUMN view_name text DEFAULT 'v_last_order_by_product_atacamax';
  END IF;
END $$;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN demo.order_sessions.schema IS 'Schema do banco de dados a ser utilizado para esta sessão';
COMMENT ON COLUMN demo.order_sessions.view_name IS 'Nome da view a ser consultada para buscar produtos do último pedido';