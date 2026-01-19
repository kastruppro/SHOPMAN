-- Archives table for storing archived shopping items
CREATE TABLE IF NOT EXISTS archives (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    items JSONB NOT NULL, -- Array of archived items
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups by list_id
CREATE INDEX IF NOT EXISTS idx_archives_list_id ON archives(list_id);
CREATE INDEX IF NOT EXISTS idx_archives_archived_at ON archives(archived_at DESC);

-- Enable RLS
ALTER TABLE archives ENABLE ROW LEVEL SECURITY;

-- Allow public read of archives for non-password protected lists
CREATE POLICY "Allow public read of archives for non-password lists" ON archives
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM lists
            WHERE lists.id = archives.list_id
            AND lists.view_requires_password = FALSE
        )
    );

-- Allow service role full access (edge functions handle password verification)
CREATE POLICY "Allow service role full access to archives" ON archives
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON archives TO anon, authenticated;
