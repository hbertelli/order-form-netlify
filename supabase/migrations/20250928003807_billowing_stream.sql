/*
  # Fix order_items foreign key constraint

  1. Changes
    - Verify and fix foreign key constraint for product_id
    - Ensure the constraint references the correct column in produtos_atacamax
    - Add proper indexes for performance

  2. Security
    - Maintain existing RLS policies
*/

-- First, let's check if the constraint exists and what it references
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'order_items_product_id_fkey' 
    AND table_name = 'order_items'
  ) THEN
    ALTER TABLE order_items DROP CONSTRAINT order_items_product_id_fkey;
    RAISE NOTICE 'Dropped existing foreign key constraint';
  END IF;
  
  -- Add the correct foreign key constraint
  -- Make sure it references the correct column in produtos_atacamax
  ALTER TABLE order_items 
  ADD CONSTRAINT order_items_product_id_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES produtos_atacamax(codprodfilho)
  ON DELETE CASCADE;
  
  RAISE NOTICE 'Added corrected foreign key constraint';
  
  -- Add index for better performance
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'order_items' 
    AND indexname = 'idx_order_items_product_id'
  ) THEN
    CREATE INDEX idx_order_items_product_id ON order_items(product_id);
    RAISE NOTICE 'Added index on product_id';
  END IF;
  
END $$;