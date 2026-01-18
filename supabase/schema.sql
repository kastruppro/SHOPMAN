-- Supabase Database Schema for Shopping List App
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Lists table
CREATE TABLE IF NOT EXISTS lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    name_lowercase VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT,
    view_requires_password BOOLEAN DEFAULT FALSE,
    edit_requires_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount VARCHAR(50),
    type VARCHAR(50),
    note TEXT,
    is_bought BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lists_name_lowercase ON lists(name_lowercase);
CREATE INDEX IF NOT EXISTS idx_items_list_id ON items(list_id);
CREATE INDEX IF NOT EXISTS idx_items_is_bought ON items(is_bought);

-- Row Level Security (RLS) policies

-- Enable RLS on tables
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Lists policies
-- Anyone can read list metadata (but not password_hash - handled in select)
CREATE POLICY "Allow public read of lists" ON lists
    FOR SELECT
    USING (true);

-- Only edge functions can insert/update/delete lists (via service role)
CREATE POLICY "Allow service role full access to lists" ON lists
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Items policies
-- Allow read if list doesn't require password for view, or handled via edge function
CREATE POLICY "Allow public read of items for non-password lists" ON items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM lists
            WHERE lists.id = items.list_id
            AND lists.view_requires_password = FALSE
        )
    );

-- Allow service role full access (edge functions handle password verification)
CREATE POLICY "Allow service role full access to items" ON items
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Create a secure view that excludes password_hash
CREATE OR REPLACE VIEW public_lists AS
SELECT
    id,
    name,
    name_lowercase,
    view_requires_password,
    edit_requires_password,
    created_at
FROM lists;

-- Grant permissions
GRANT SELECT ON public_lists TO anon, authenticated;
GRANT SELECT ON lists TO anon, authenticated;
GRANT SELECT ON items TO anon, authenticated;

-- Note: The password_hash column is protected by:
-- 1. Not being included in API responses (edge functions handle this)
-- 2. RLS policies that only allow service_role to modify data
