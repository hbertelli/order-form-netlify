/*
  # Add Function to Get Next Order Number

  1. New Functions
    - `get_next_order_number()` - Returns the next order number that will be assigned
    
  2. Purpose
    - Allows the create-session API to show an estimated order number
    - Useful for preview purposes before actual order submission
*/

-- Function to get the next order number (for preview purposes)
CREATE OR REPLACE FUNCTION get_next_order_number()
RETURNS TABLE(next_val bigint) AS $$
BEGIN
  RETURN QUERY SELECT nextval('order_number_seq');
END;
$$ LANGUAGE plpgsql;