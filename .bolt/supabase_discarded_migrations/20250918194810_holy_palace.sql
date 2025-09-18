/*
  # Add Estimated Order Number to Sessions

  1. Changes
    - Add `estimated_order_number` column to `order_sessions` table
    - This stores the estimated order number shown to users during session creation
    - Helps provide continuity between session creation and final order submission

  2. Purpose
    - Store the estimated order number from create-session API
    - Display consistent numbering to users throughout the process
*/

-- Add estimated_order_number column to order_sessions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo' AND table_name = 'order_sessions' AND column_name = 'estimated_order_number'
  ) THEN
    ALTER TABLE order_sessions ADD COLUMN estimated_order_number bigint;
  END IF;
END $$;