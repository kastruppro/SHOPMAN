-- Enable http extension for push notification triggers
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Note: The database settings for app.settings.supabase_url and app.settings.service_role_key
-- need to be set manually in the Supabase Dashboard SQL Editor:
--
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://wekhpejczeqdjxididog.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your_service_role_key_here';
--
-- These cannot be set via migrations because the service_role_key should not be committed to git.
