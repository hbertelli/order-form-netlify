/*
  # Add Sequential Order Number System

  1. New Features
    - Add `order_number` column to `orders_submitted` table
    - Create sequence for auto-generating order numbers
    - Add trigger to automatically assign order numbers
    - Add index for performance

  2. Changes
    - `orders_submitted` table gets new `order_number` column (bigint, unique, not null)
    - Sequence `order_number_seq` starts at 1000 for better formatting
    - Trigger automatically assigns next sequence value on insert

  3. Security
    - No RLS changes needed as this table inherits existing policies
*/

-- Create sequence for order numbers starting at 1000
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000;

-- Add order_number column to orders_submitted table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo' AND table_name = 'orders_submitted' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE orders_submitted ADD COLUMN order_number bigint UNIQUE NOT NULL DEFAULT nextval('order_number_seq');
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_submitted_order_number ON orders_submitted(order_number);

-- Create trigger function to auto-assign order numbers
CREATE OR REPLACE FUNCTION assign_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := nextval('order_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_assign_order_number ON orders_submitted;
CREATE TRIGGER trigger_assign_order_number
  BEFORE INSERT ON orders_submitted
  FOR EACH ROW
  EXECUTE FUNCTION assign_order_number();