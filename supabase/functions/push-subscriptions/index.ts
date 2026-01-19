// Supabase Edge Function: push-subscriptions
// Handles subscribe and unsubscribe operations for push notifications

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubscribeRequest {
  action: "subscribe";
  list_id: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

interface UnsubscribeRequest {
  action: "unsubscribe";
  list_id: string;
}

type PushSubscriptionRequest = SubscribeRequest | UnsubscribeRequest;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const body: PushSubscriptionRequest = await req.json();
    const { action, list_id } = body;

    if (!list_id) {
      return new Response(
        JSON.stringify({ error: "List ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the list exists
    const { data: list, error: listError } = await supabaseClient
      .from("lists")
      .select("id, name")
      .eq("id", list_id)
      .single();

    if (listError || !list) {
      return new Response(
        JSON.stringify({ error: "List not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle SUBSCRIBE action
    if (action === "subscribe") {
      const { subscription } = body as SubscribeRequest;

      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return new Response(
          JSON.stringify({ error: "Valid subscription object is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert the subscription (update if exists, insert if not)
      const { data: newSub, error: upsertError } = await supabaseClient
        .from("push_subscriptions")
        .upsert(
          {
            list_id,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
          {
            onConflict: "list_id,endpoint",
          }
        )
        .select()
        .single();

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        return new Response(
          JSON.stringify({ error: "Failed to save subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, subscription: newSub }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle UNSUBSCRIBE action
    if (action === "unsubscribe") {
      // Delete all subscriptions for this list from this client
      // Note: In production, you might want to identify specific endpoints
      const { error: deleteError } = await supabaseClient
        .from("push_subscriptions")
        .delete()
        .eq("list_id", list_id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to remove subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'subscribe' or 'unsubscribe'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
