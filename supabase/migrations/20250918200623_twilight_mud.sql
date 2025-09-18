/*
  # Create Order Number Sequence System

  1. New Tables
    - Creates sequence for order numbers starting at 1000
    - Adds order_number column to orders_submitted table
    - Adds estimated_order_number to order_sessions table
  
  2. Functions
    - get_next_order_number() function to preview next order number
  
  3. Triggers
    - Auto-assign order numbers when orders are submitted
  
  4. Security
    - Maintains existing RLS policies
*/

-- Create sequence for order numbers starting at 1000
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000;

-- Add order_number column to orders_submitted table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders_submitted' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE orders_submitted ADD COLUMN order_number INTEGER UNIQUE;
  END IF;
END $$;

-- Add estimated_order_number column to order_sessions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_sessions' AND column_name = 'estimated_order_number'
  ) THEN
    ALTER TABLE order_sessions ADD COLUMN estimated_order_number INTEGER;
  END IF;
END $$;

-- Function to get next order number (for preview)
CREATE OR REPLACE FUNCTION get_next_order_number()
RETURNS TABLE(next_val INTEGER) AS $$
BEGIN
  RETURN QUERY SELECT nextval('order_number_seq')::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-assign order numbers
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