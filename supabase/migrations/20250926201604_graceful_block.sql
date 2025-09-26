/*
  # Adicionar campos de preço aos itens do orçamento

  1. Alterações na Tabela
    - `order_items`
      - `unit_price` (decimal) - Preço unitário no momento da criação
      - `promo_price` (decimal) - Preço promocional no momento da criação
      - `original_price` (decimal) - Preço original no momento da criação

  2. Alterações na Tabela
    - `orders_submitted`
      - Adicionar campos do aprovador no payload (já existe como JSONB)

  3. Funcionalidade
    - Preços são "congelados" no momento da criação do orçamento
    - Não dependem mais dos preços atuais dos produtos
    - Dados do aprovador são exibidos quando orçamento já foi aprovado
*/

-- Adicionar campos de preço à tabela order_items
DO $$
BEGIN
  -- Adicionar unit_price se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE order_items ADD COLUMN unit_price DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- Adicionar promo_price se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'promo_price'
  ) THEN
    ALTER TABLE order_items ADD COLUMN promo_price DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- Adicionar original_price se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'original_price'
  ) THEN
    ALTER TABLE order_items ADD COLUMN original_price DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- Atualizar itens existentes com preços dos produtos atuais
UPDATE order_items 
SET 
  unit_price = COALESCE(
    CASE 
      WHEN p.promo3 > 0 AND p.promo3 < p.preco3 THEN p.promo3
      ELSE p.preco3
    END, 0
  ),
  promo_price = COALESCE(p.promo3, 0),
  original_price = COALESCE(p.preco3, 0)
FROM produtos_atacamax p
WHERE order_items.product_id = p.codprodfilho
  AND (order_items.unit_price IS NULL OR order_items.unit_price = 0);