// Supabase Edge Function: send-push-notification
// Sends push notifications to all subscribers of a list
// Called by database triggers or manually when list items change

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get environment variables
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@shopman.app";

interface NotificationRequest {
  list_id: string;
  list_name?: string;
  title?: string;
  body?: string;
  action?: "add" | "update" | "delete";
  item_name?: string;
}

// Base64URL encode
function base64UrlEncode(data: Uint8Array): string {
  return base64Encode(data)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// Create VAPID JWT token
async function createVapidJwt(audience: string): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: VAPID_SUBJECT,
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key for signing
  const privateKeyBytes = base64UrlDecode(VAPID_PRIVATE_KEY);

  // Create the key for signing
  const key = await crypto.subtle.importKey(
    "raw",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  return `${unsignedToken}.${signatureB64}`;
}

// Base64URL decode
function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Send a push notification to a single subscription
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract the origin from the endpoint for the VAPID audience
    const endpointUrl = new URL(subscription.endpoint);
    const audience = endpointUrl.origin;

    // Create VAPID JWT
    const jwt = await createVapidJwt(audience);

    // For a complete implementation, you would need to:
    // 1. Generate an encryption key pair
    // 2. Encrypt the payload using the subscription's p256dh and auth keys
    // 3. Send the encrypted payload with proper headers
    //
    // This is complex crypto - for production, consider using a service like:
    // - Firebase Cloud Messaging
    // - OneSignal
    // - Or a Deno-compatible web-push library

    // Simplified version - send unencrypted notification metadata
    // The actual encryption requires ECDH + HKDF + AES-GCM
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400", // 24 hours
        "Urgency": "normal",
      },
      body: payload, // In production, this needs to be encrypted
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Push failed: ${response.status} - ${errorText}`);

      // Handle specific error codes
      if (response.status === 410 || response.status === 404) {
        // Subscription has expired or is invalid - should be removed
        return { success: false, error: "subscription_expired" };
      }

      return { success: false, error: `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending push:", error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Check VAPID keys are configured
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error("VAPID keys not configured");
      return new Response(
        JSON.stringify({ error: "Push notifications not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const body: NotificationRequest = await req.json();
    const { list_id, list_name, title, body: notificationBody, action, item_name } = body;

    if (!list_id) {
      return new Response(
        JSON.stringify({ error: "List ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get list info if not provided
    let listName = list_name;
    if (!listName) {
      const { data: list } = await supabaseClient
        .from("lists")
        .select("name")
        .eq("id", list_id)
        .single();
      listName = list?.name || "Shopping List";
    }

    // Build notification content
    let notificationTitle = title;
    let notificationBodyText = notificationBody;

    if (!notificationTitle) {
      notificationTitle = listName;
    }

    if (!notificationBodyText && action && item_name) {
      switch (action) {
        case "add":
          notificationBodyText = `"${item_name}" blev tilføjet`;
          break;
        case "update":
          notificationBodyText = `"${item_name}" blev opdateret`;
          break;
        case "delete":
          notificationBodyText = `"${item_name}" blev fjernet`;
          break;
        default:
          notificationBodyText = "Listen blev opdateret";
      }
    } else if (!notificationBodyText) {
      notificationBodyText = "Listen blev opdateret";
    }

    // Get all subscriptions for this list
    const { data: subscriptions, error: subError } = await supabaseClient
      .from("push_subscriptions")
      .select("*")
      .eq("list_id", list_id);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscribers" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare notification payload
    const payload = JSON.stringify({
      title: notificationTitle,
      body: notificationBodyText,
      data: {
        listId: list_id,
        listName: listName,
        url: `/#list/${encodeURIComponent(listName)}`,
      },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
    });

    // Send to all subscribers
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const result = await sendPushNotification(
          {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
          payload
        );

        // Remove expired subscriptions
        if (!result.success && result.error === "subscription_expired") {
          await supabaseClient
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }

        return result;
      })
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        failed: failed,
        total: subscriptions.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
