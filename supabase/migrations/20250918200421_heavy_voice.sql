/*
  # Create Order Number Sequence System

  1. New Sequence
    - `order_number_seq` starting at 1000
    - Provides sequential order numbers

  2. New Function
    - `get_next_order_number()` to preview next number
    - Used for estimated order numbers in sessions

  3. Updated Tables
    - Add `order_number` column to `orders_submitted`
    - Add `estimated_order_number` column to `order_sessions`
    - Add trigger to auto-assign order numbers

  4. Security
    - Maintain existing RLS policies
*/

-- Create sequence for order numbers starting at 1000
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000 INCREMENT 1;

-- Function to get the next order number (for estimation)
CREATE OR REPLACE FUNCTION get_next_order_number()
RETURNS TABLE(next_val bigint) AS $$
BEGIN
  RETURN QUERY SELECT nextval('order_number_seq'::regclass);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add order_number column to orders_submitted if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders_submitted' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE orders_submitted ADD COLUMN order_number bigint UNIQUE;
  END IF;
END $$;

-- Add estimated_order_number column to order_sessions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_sessions' AND column_name = 'estimated_order_number'
  ) THEN
    ALTER TABLE order_sessions ADD COLUMN estimated_order_number bigint;
  END IF;
END $$;

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

-- Create trigger on orders_submitted
DROP TRIGGER IF EXISTS trigger_assign_order_number ON orders_submitted;
CREATE TRIGGER trigger_assign_order_number
  BEFORE INSERT ON orders_submitted
  FOR EACH ROW
  EXECUTE FUNCTION assign_order_number();