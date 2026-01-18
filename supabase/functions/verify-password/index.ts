// Supabase Edge Function: verify-password
// Verifies a password for a list and returns an access token

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyPasswordRequest {
  list_id: string;
  password: string;
  action: "view" | "edit";
}

// Simple token generation (in production, consider using JWT)
function generateToken(listId: string, action: string): string {
  const payload = {
    list_id: listId,
    action: action,
    exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    rand: crypto.randomUUID(),
  };
  return base64Encode(JSON.stringify(payload));
}

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

    const { list_id, password, action }: VerifyPasswordRequest = await req.json();

    // Validate input
    if (!list_id || !password) {
      return new Response(
        JSON.stringify({ error: "List ID and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["view", "edit"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Action must be 'view' or 'edit'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the list with password hash
    const { data: list, error: fetchError } = await supabaseClient
      .from("lists")
      .select("id, password_hash, view_requires_password, edit_requires_password")
      .eq("id", list_id)
      .single();

    if (fetchError || !list) {
      return new Response(
        JSON.stringify({ error: "List not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this action requires a password
    const requiresPassword = action === "view"
      ? list.view_requires_password
      : list.edit_requires_password;

    if (!requiresPassword) {
      // No password required, return success
      return new Response(
        JSON.stringify({ success: true, token: generateToken(list_id, action) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No password hash stored (shouldn't happen, but handle it)
    if (!list.password_hash) {
      return new Response(
        JSON.stringify({ success: true, token: generateToken(list_id, action) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the password
    const isValid = await bcrypt.compare(password, list.password_hash);

    if (!isValid) {
      return new Response(
        JSON.stringify({ success: false, error: "Incorrect password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Password is correct, generate access token
    const token = generateToken(list_id, action);

    return new Response(
      JSON.stringify({ success: true, token }),
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
