@@ .. @@
 -- The order_number will now be explicitly set from the session's estimated_order_number
 -- No trigger needed, the application will handle the assignment
+
+-- Create a function to get and consume the next order number atomically
+CREATE OR REPLACE FUNCTION demo.get_and_consume_order_number()
+RETURNS INTEGER
+LANGUAGE plpgsql
+SECURITY DEFINER
+AS $$
+BEGIN
+  RETURN nextval('demo.order_number_seq');
+END;
+$$;
+
+-- Grant execute permission to service role
+GRANT EXECUTE ON FUNCTION demo.get_and_consume_order_number() TO service_role;