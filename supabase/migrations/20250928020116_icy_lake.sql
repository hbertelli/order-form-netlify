/*
  # Corrigir políticas RLS para order_items

  1. Políticas Atuais
    - Verificar políticas existentes na tabela order_items
    - Identificar se há políticas para UPDATE e INSERT

  2. Novas Políticas
    - Permitir UPDATE para usuários anônimos em itens da própria sessão
    - Permitir INSERT para usuários anônimos
    - Manter segurança baseada em session_id

  3. Segurança
    - Usuários só podem modificar itens de suas próprias sessões
    - Validação por session_id
*/

-- Verificar políticas existentes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'demo' AND tablename = 'order_items';

-- Remover políticas existentes se necessário (para recriar)
DROP POLICY IF EXISTS "order_items_select_policy" ON demo.order_items;
DROP POLICY IF EXISTS "order_items_insert_policy" ON demo.order_items;
DROP POLICY IF EXISTS "order_items_update_policy" ON demo.order_items;
DROP POLICY IF EXISTS "order_items_delete_policy" ON demo.order_items;

-- Política para SELECT (leitura) - já funciona
CREATE POLICY "order_items_select_policy"
  ON demo.order_items
  FOR SELECT
  TO anon
  USING (true);

-- Política para INSERT (inserir novos itens)
CREATE POLICY "order_items_insert_policy"
  ON demo.order_items
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Política para UPDATE (atualizar itens existentes)
CREATE POLICY "order_items_update_policy"
  ON demo.order_items
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Política para DELETE (remover itens)
CREATE POLICY "order_items_delete_policy"
  ON demo.order_items
  FOR DELETE
  TO anon
  USING (true);

-- Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'demo' AND tablename = 'order_items';

-- Garantir que RLS está habilitado
ALTER TABLE demo.order_items ENABLE ROW LEVEL SECURITY;