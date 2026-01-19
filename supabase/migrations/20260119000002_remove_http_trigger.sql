-- Remove the custom HTTP trigger (we'll use Supabase Database Webhooks instead)
DROP TRIGGER IF EXISTS on_item_change_notify ON items;
DROP FUNCTION IF EXISTS notify_list_subscribers();

-- The push notification will be triggered via Supabase Database Webhooks
-- which is configured in the Supabase Dashboard under Database → Webhooks
