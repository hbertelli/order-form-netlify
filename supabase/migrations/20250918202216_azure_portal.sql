/*
  # Fix Order Number Consistency

  1. Changes
    - Remove auto-increment trigger from orders_submitted
    - Use the estimated_order_number from session as the actual order_number
    - Ensure consistency between order_sessions and orders_submitted tables

  2. Security
    - Maintain existing RLS policies
*/

-- Remove the existing trigger that auto-assigns order numbers
DROP TRIGGER IF EXISTS assign_order_number_trigger ON demo.orders_submitted;

-- Remove the assign_order_number function since we won't use it anymore
DROP FUNCTION IF EXISTS demo.assign_order_number();

-- The order_number will now be explicitly set from the session's estimated_order_number
-- No trigger needed, the application will handle the assignment