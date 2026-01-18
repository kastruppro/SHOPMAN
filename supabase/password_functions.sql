-- Password hashing functions using pgcrypto
-- Run this in Supabase SQL Editor

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to hash a password
CREATE OR REPLACE FUNCTION hash_password(pwd TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN crypt(pwd, gen_salt('bf', 10));
END;
$$;

-- Function to verify a password
CREATE OR REPLACE FUNCTION verify_password(pwd TEXT, pwd_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pwd_hash = crypt(pwd, pwd_hash);
END;
$$;

-- Grant execute to authenticated and anon (needed for RPC calls)
GRANT EXECUTE ON FUNCTION hash_password(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION verify_password(TEXT, TEXT) TO authenticated, anon, service_role;
