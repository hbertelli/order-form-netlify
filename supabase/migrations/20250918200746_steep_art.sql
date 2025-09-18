/*
  # Create Order Number Sequence System for Demo Schema

  1. New Sequence
    - `order_number_seq` starting at 1000 for sequential order numbering
  
  2. Table Updates
    - Add `order_number` column to `orders_submitted` table (auto-generated, unique)
    - Add `estimated_order_number` column to `order_sessions` table
  
  3. Functions
    - `get_next_order_number()` to preview the next order number
    - `assign_order_number()` trigger function to auto-assign order numbers
  
  4. Trigger
    - Auto-assign order numbers when inserting into `orders_submitted`
  
  5. Security
    - Enable RLS on updated tables
    - Add appropriate policies
*/

-- Set schema to demo
SET search_path TO demo;

-- Create sequence for order numbers starting at 1000
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000 INCREMENT 1;

-- Add order_number column to orders_submitted table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo' AND table_name = 'orders_submitted' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE demo.orders_submitted ADD COLUMN order_number INTEGER UNIQUE;
  END IF;
END $$;

-- Add estimated_order_number column to order_sessions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo' AND table_name = 'order_sessions' AND column_name = 'estimated_order_number'
  ) THEN
    ALTER TABLE demo.order_sessions ADD COLUMN estimated_order_number INTEGER;
  END IF;
END $$;

-- Function to get next order number for preview
CREATE OR REPLACE FUNCTION demo.get_next_order_number()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN nextval('demo.order_number_seq'::regclass);
END;
$$;

-- Function to assign order number (for trigger)
CREATE OR REPLACE FUNCTION demo.assign_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := nextval('demo.order_number_seq'::regclass);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign order numbers
DROP TRIGGER IF EXISTS assign_order_number_trigger ON demo.orders_submitted;
CREATE TRIGGER assign_order_number_trigger
  BEFORE INSERT ON demo.orders_submitted
  FOR EACH ROW
  EXECUTE FUNCTION demo.assign_order_number();

-- Ensure RLS is enabled on tables
ALTER TABLE demo.orders_submitted ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.order_sessions ENABLE ROW LEVEL SECURITY;

-- Add policies for order_number access (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'demo' AND tablename = 'orders_submitted' AND policyname = 'Allow service role full access to orders_submitted'
  ) THEN
    CREATE POLICY "Allow service role full access to orders_submitted"
      ON demo.orders_submitted
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'demo' AND tablename = 'order_sessions' AND policyname = 'Allow service role full access to order_sessions'
  ) THEN
    CREATE POLICY "Allow service role full access to order_sessions"
      ON demo.order_sessions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;