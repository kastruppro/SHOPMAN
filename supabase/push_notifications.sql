-- Push Notifications Schema for SHOPMAN
-- Run this in the Supabase SQL Editor after the main schema

-- Enable the http extension for calling edge functions from triggers
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- =============================================================================
-- PUSH SUBSCRIPTIONS TABLE
-- =============================================================================

-- Create table to store push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Unique constraint on list_id + endpoint to prevent duplicate subscriptions
    UNIQUE(list_id, endpoint)
);

-- Create index for faster lookups by list_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_list_id ON push_subscriptions(list_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions handle all operations)
CREATE POLICY "Allow service role full access to push_subscriptions" ON push_subscriptions
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- UPDATE TIMESTAMP TRIGGER
-- =============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update the updated_at column
CREATE TRIGGER push_subscription_updated_at
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_push_subscription_timestamp();

-- =============================================================================
-- PUSH NOTIFICATION TRIGGER FOR ITEM CHANGES
-- =============================================================================

-- Function to send push notifications when items change
-- Note: This requires the http extension and your Supabase project URL
CREATE OR REPLACE FUNCTION notify_list_subscribers()
RETURNS TRIGGER AS $$
DECLARE
    v_list_id UUID;
    v_list_name TEXT;
    v_item_name TEXT;
    v_action TEXT;
    v_supabase_url TEXT;
    v_service_key TEXT;
    v_response extensions.http_response;
BEGIN
    -- Get the Supabase URL from environment (set this in your dashboard)
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.service_role_key', true);

    -- If settings not configured, skip silently
    IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Determine the list_id and action based on operation
    IF TG_OP = 'DELETE' THEN
        v_list_id := OLD.list_id;
        v_item_name := OLD.name;
        v_action := 'delete';
    ELSE
        v_list_id := NEW.list_id;
        v_item_name := NEW.name;
        IF TG_OP = 'INSERT' THEN
            v_action := 'add';
        ELSE
            v_action := 'update';
        END IF;
    END IF;

    -- Get list name
    SELECT name INTO v_list_name FROM lists WHERE id = v_list_id;

    -- Check if there are any subscribers for this list
    IF EXISTS (SELECT 1 FROM push_subscriptions WHERE list_id = v_list_id) THEN
        -- Call the edge function to send notifications
        -- Note: This is async and won't block the transaction
        BEGIN
            SELECT * INTO v_response FROM extensions.http((
                'POST',
                v_supabase_url || '/functions/v1/send-push-notification',
                ARRAY[
                    extensions.http_header('Authorization', 'Bearer ' || v_service_key),
                    extensions.http_header('Content-Type', 'application/json')
                ],
                'application/json',
                json_build_object(
                    'list_id', v_list_id,
                    'list_name', v_list_name,
                    'action', v_action,
                    'item_name', v_item_name
                )::text
            )::extensions.http_request);
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail the transaction
            RAISE WARNING 'Failed to send push notification: %', SQLERRM;
        END;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for item changes
-- Note: Using AFTER trigger so it doesn't block the main operation
DROP TRIGGER IF EXISTS on_item_change_notify ON items;
CREATE TRIGGER on_item_change_notify
    AFTER INSERT OR UPDATE OR DELETE ON items
    FOR EACH ROW
    EXECUTE FUNCTION notify_list_subscribers();

-- =============================================================================
-- ALTERNATIVE: SIMPLER TRIGGER USING pg_net (if available)
-- =============================================================================

-- If you have pg_net extension enabled (newer Supabase projects),
-- you can use this simpler async approach instead:

/*
CREATE OR REPLACE FUNCTION notify_list_subscribers_async()
RETURNS TRIGGER AS $$
DECLARE
    v_list_id UUID;
    v_item_name TEXT;
    v_action TEXT;
BEGIN
    -- Determine the list_id and action based on operation
    IF TG_OP = 'DELETE' THEN
        v_list_id := OLD.list_id;
        v_item_name := OLD.name;
        v_action := 'delete';
    ELSE
        v_list_id := NEW.list_id;
        v_item_name := NEW.name;
        IF TG_OP = 'INSERT' THEN
            v_action := 'add';
        ELSE
            v_action := 'update';
        END IF;
    END IF;

    -- Check if there are any subscribers for this list
    IF EXISTS (SELECT 1 FROM push_subscriptions WHERE list_id = v_list_id) THEN
        -- Use pg_net for async HTTP call
        PERFORM net.http_post(
            url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
                'Content-Type', 'application/json'
            ),
            body := jsonb_build_object(
                'list_id', v_list_id,
                'action', v_action,
                'item_name', v_item_name
            )
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO service_role;
GRANT USAGE ON SCHEMA extensions TO service_role;
