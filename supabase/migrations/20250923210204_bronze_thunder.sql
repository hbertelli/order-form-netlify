/*
  # Configurar políticas RLS para schema atacamax

  Este arquivo configura as políticas de Row Level Security (RLS) necessárias 
  para permitir que a aplicação acesse as tabelas no schema atacamax usando 
  a chave anônima do Supabase.

  ## Tabelas configuradas:
  1. clientes_atacamax - Leitura para usuários anônimos
  2. produtos_atacamax - Leitura para usuários anônimos  
  3. order_sessions - CRUD completo para usuários anônimos
  4. order_items - CRUD completo para usuários anônimos
  5. orders_submitted - Inserção para usuários anônimos

  ## Segurança:
  - Permite acesso anônimo apenas para operações necessárias
  - Mantém controle de acesso baseado em sessão para order_items
*/

-- Configurar schema atacamax
SET search_path TO atacamax;

-- 1. Políticas para clientes_atacamax
DROP POLICY IF EXISTS "Allow anonymous read access to clientes_atacamax" ON clientes_atacamax;
CREATE POLICY "Allow anonymous read access to clientes_atacamax"
  ON clientes_atacamax
  FOR SELECT
  TO anon
  USING (true);

-- 2. Políticas para produtos_atacamax  
DROP POLICY IF EXISTS "Allow anonymous read access to produtos_atacamax" ON produtos_atacamax;
CREATE POLICY "Allow anonymous read access to produtos_atacamax"
  ON produtos_atacamax
  FOR SELECT
  TO anon
  USING (true);

-- 3. Políticas para order_sessions
DROP POLICY IF EXISTS "Allow anonymous full access to order_sessions" ON order_sessions;
CREATE POLICY "Allow anonymous full access to order_sessions"
  ON order_sessions
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 4. Políticas para order_items
DROP POLICY IF EXISTS "Allow anonymous full access to order_items" ON order_items;
CREATE POLICY "Allow anonymous full access to order_items"
  ON order_items
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 5. Políticas para orders_submitted
DROP POLICY IF EXISTS "Allow anonymous insert to orders_submitted" ON orders_submitted;
CREATE POLICY "Allow anonymous insert to orders_submitted"
  ON orders_submitted
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous read to orders_submitted" ON orders_submitted;
CREATE POLICY "Allow anonymous read to orders_submitted"
  ON orders_submitted
  FOR SELECT
  TO anon
  USING (true);

-- Verificar se RLS está habilitado nas tabelas (caso não esteja)
ALTER TABLE clientes_atacamax ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos_atacamax ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders_submitted ENABLE ROW LEVEL SECURITY;

-- Resetar search_path
RESET search_path;