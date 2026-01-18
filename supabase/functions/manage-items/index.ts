// Supabase Edge Function: manage-items
// Handles add, update, and delete operations for list items

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-access-token",
};

interface AddItemRequest {
  action: "add";
  list_id: string;
  item: {
    name: string;
    amount?: string | null;
    type?: string | null;
    note?: string | null;
  };
  token?: string | null;
}

interface UpdateItemRequest {
  action: "update";
  item_id: string;
  updates: {
    name?: string;
    amount?: string | null;
    type?: string | null;
    note?: string | null;
    is_bought?: boolean;
  };
  token?: string | null;
}

interface DeleteItemRequest {
  action: "delete";
  item_id: string;
  token?: string | null;
}

type ManageItemsRequest = AddItemRequest | UpdateItemRequest | DeleteItemRequest;

// Verify the access token
function verifyToken(token: string, listId: string): boolean {
  try {
    const decoded = new TextDecoder().decode(base64Decode(token));
    const payload = JSON.parse(decoded);

    // Check expiration
    if (payload.exp < Date.now()) {
      return false;
    }

    // Check list_id matches
    if (payload.list_id !== listId) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
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

    const body: ManageItemsRequest = await req.json();
    const { action, token } = body;

    // Helper to check edit permission
    async function checkEditPermission(listId: string): Promise<boolean> {
      const { data: list } = await supabaseClient
        .from("lists")
        .select("edit_requires_password")
        .eq("id", listId)
        .single();

      if (!list) return false;

      if (!list.edit_requires_password) {
        return true; // No password required
      }

      if (!token) {
        return false; // Password required but no token
      }

      return verifyToken(token, listId);
    }

    // Handle ADD action
    if (action === "add") {
      const { list_id, item } = body as AddItemRequest;

      if (!list_id || !item || !item.name) {
        return new Response(
          JSON.stringify({ error: "List ID and item name are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check permission
      const hasPermission = await checkEditPermission(list_id);
      if (!hasPermission) {
        return new Response(
          JSON.stringify({ error: "Password required to edit this list" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert the item
      const { data: newItem, error: insertError } = await supabaseClient
        .from("items")
        .insert({
          list_id,
          name: item.name.trim(),
          amount: item.amount?.trim() || null,
          type: item.type || null,
          note: item.note?.trim() || null,
          is_bought: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to add item" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(newItem),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle UPDATE action
    if (action === "update") {
      const { item_id, updates } = body as UpdateItemRequest;

      if (!item_id || !updates) {
        return new Response(
          JSON.stringify({ error: "Item ID and updates are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the item to find its list_id
      const { data: item } = await supabaseClient
        .from("items")
        .select("list_id")
        .eq("id", item_id)
        .single();

      if (!item) {
        return new Response(
          JSON.stringify({ error: "Item not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check permission
      const hasPermission = await checkEditPermission(item.list_id);
      if (!hasPermission) {
        return new Response(
          JSON.stringify({ error: "Password required to edit this list" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update the item
      const { data: updatedItem, error: updateError } = await supabaseClient
        .from("items")
        .update(updates)
        .eq("id", item_id)
        .select()
        .single();

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update item" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(updatedItem),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle DELETE action
    if (action === "delete") {
      const { item_id } = body as DeleteItemRequest;

      if (!item_id) {
        return new Response(
          JSON.stringify({ error: "Item ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the item to find its list_id
      const { data: item } = await supabaseClient
        .from("items")
        .select("list_id")
        .eq("id", item_id)
        .single();

      if (!item) {
        return new Response(
          JSON.stringify({ error: "Item not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check permission
      const hasPermission = await checkEditPermission(item.list_id);
      if (!hasPermission) {
        return new Response(
          JSON.stringify({ error: "Password required to edit this list" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete the item
      const { error: deleteError } = await supabaseClient
        .from("items")
        .delete()
        .eq("id", item_id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete item" }),
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
