// Supabase Edge Function: manage-list
// Handles list settings: update password, delete list

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-access-token",
};

interface UpdatePasswordRequest {
  action: "update_password";
  list_id: string;
  current_password?: string;
  new_password?: string | null; // null to remove password
  view_requires_password?: boolean;
  edit_requires_password?: boolean;
}

interface DeleteListRequest {
  action: "delete";
  list_id: string;
  password?: string;
}

type ManageListRequest = UpdatePasswordRequest | DeleteListRequest;

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

    const body: ManageListRequest = await req.json();
    const { action, list_id } = body;

    if (!list_id) {
      return new Response(
        JSON.stringify({ error: "List ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the list
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

    // Helper to verify password
    async function verifyCurrentPassword(password: string): Promise<boolean> {
      if (!list.password_hash) return true; // No password set

      const { data: isValid } = await supabaseClient
        .rpc('verify_password', { pwd: password, pwd_hash: list.password_hash });

      return isValid === true;
    }

    // Handle UPDATE PASSWORD action
    if (action === "update_password") {
      const { current_password, new_password, view_requires_password, edit_requires_password } = body as UpdatePasswordRequest;

      // If list has a password, verify current password first
      if (list.password_hash) {
        if (!current_password) {
          return new Response(
            JSON.stringify({ error: "Current password is required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const isValid = await verifyCurrentPassword(current_password);
        if (!isValid) {
          return new Response(
            JSON.stringify({ error: "Incorrect password" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Hash new password if provided
      let newPasswordHash: string | null = null;
      if (new_password && new_password.length > 0) {
        const { data: hashResult, error: hashError } = await supabaseClient
          .rpc('hash_password', { pwd: new_password });

        if (hashError) {
          console.error("Hash error:", hashError);
          return new Response(
            JSON.stringify({ error: "Failed to process password" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        newPasswordHash = hashResult;
      }

      // Update the list
      const updateData: Record<string, unknown> = {
        password_hash: newPasswordHash,
      };

      // Only update these if password is being set
      if (newPasswordHash) {
        updateData.view_requires_password = view_requires_password ?? false;
        updateData.edit_requires_password = edit_requires_password ?? true;
      } else {
        // Removing password, disable both requirements
        updateData.view_requires_password = false;
        updateData.edit_requires_password = false;
      }

      const { error: updateError } = await supabaseClient
        .from("lists")
        .update(updateData)
        .eq("id", list_id);

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update list" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle DELETE action
    if (action === "delete") {
      const { password } = body as DeleteListRequest;

      // If list has a password, verify it first
      if (list.password_hash) {
        if (!password) {
          return new Response(
            JSON.stringify({ error: "Password is required to delete this list" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const isValid = await verifyCurrentPassword(password);
        if (!isValid) {
          return new Response(
            JSON.stringify({ error: "Incorrect password" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Delete the list (items will be cascade deleted)
      const { error: deleteError } = await supabaseClient
        .from("lists")
        .delete()
        .eq("id", list_id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete list" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
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
