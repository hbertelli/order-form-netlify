/*
  # Create Consistent Order Number System for Demo Schema

  1. New Tables
    - `demo.order_sessions` - Session management with order numbers
    - `demo.order_items` - Items in each session
    - `demo.orders_submitted` - Final submitted orders
  
  2. Sequential Order Numbers
    - Sequence `demo.order_number_seq` starting at 1000
    - Function `demo.get_and_consume_order_number()` atomically consumes numbers
    - Consistent numbering between session and final order
  
  3. Security
    - Enable RLS on all tables
    - Service role policies for backend operations
*/

-- Create demo schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS demo;

-- Create sequence for order numbers starting at 1000
CREATE SEQUENCE IF NOT EXISTS demo.order_number_seq START WITH 1000 INCREMENT BY 1;

-- Function to atomically get and consume the next order number
CREATE OR REPLACE FUNCTION demo.get_and_consume_order_number()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN nextval('demo.order_number_seq');
END;
$$;

-- Create order_sessions table
CREATE TABLE IF NOT EXISTS demo.order_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id integer NOT NULL,
  estimated_order_number integer,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS demo.order_items (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES demo.order_sessions(id) ON DELETE CASCADE,
  product_id integer NOT NULL,
  qty decimal(10,3) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create orders_submitted table
CREATE TABLE IF NOT EXISTS demo.orders_submitted (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES demo.order_sessions(id),
  customer_id integer NOT NULL,
  order_number integer NOT NULL,
  payload jsonb,
  submitted_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE demo.order_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.orders_submitted ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY "Service role can manage order_sessions"
  ON demo.order_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage order_items"
  ON demo.order_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage orders_submitted"
  ON demo.orders_submitted
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_sessions_customer_id ON demo.order_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_sessions_expires_at ON demo.order_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_order_items_session_id ON demo.order_items(session_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON demo.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_submitted_customer_id ON demo.orders_submitted(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_submitted_order_number ON demo.orders_submitted(order_number);