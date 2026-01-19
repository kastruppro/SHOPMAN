// Supabase Edge Function: manage-archives
// Handles archive, delete, and undo operations for list items

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-access-token",
};

interface ArchiveBoughtRequest {
  action: "archive_bought";
  list_id: string;
  token?: string | null;
}

interface DeleteBoughtRequest {
  action: "delete_bought";
  list_id: string;
  token?: string | null;
}

interface DeleteAllRequest {
  action: "delete_all";
  list_id: string;
  token?: string | null;
}

interface GetArchivesRequest {
  action: "get_archives";
  list_id: string;
  token?: string | null;
}

interface DeleteArchiveRequest {
  action: "delete_archive";
  archive_id: string;
  list_id: string;
  token?: string | null;
}

interface UndoRequest {
  action: "undo";
  list_id: string;
  undo_data: {
    type: "archive" | "delete_bought" | "delete_all" | "delete_archive";
    items?: any[];
    archive?: any;
  };
  token?: string | null;
}

type ManageArchivesRequest =
  | ArchiveBoughtRequest
  | DeleteBoughtRequest
  | DeleteAllRequest
  | GetArchivesRequest
  | DeleteArchiveRequest
  | UndoRequest;

// Verify the access token
function verifyToken(token: string, listId: string): boolean {
  try {
    const decoded = new TextDecoder().decode(base64Decode(token));
    const payload = JSON.parse(decoded);

    if (payload.exp < Date.now()) {
      return false;
    }

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

    const body: ManageArchivesRequest = await req.json();
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
        return true;
      }

      if (!token) {
        return false;
      }

      return verifyToken(token, listId);
    }

    // Handle ARCHIVE_BOUGHT action
    if (action === "archive_bought") {
      const { list_id } = body as ArchiveBoughtRequest;

      if (!list_id) {
        return new Response(
          JSON.stringify({ error: "List ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hasPermission = await checkEditPermission(list_id);
      if (!hasPermission) {
        return new Response(
          JSON.stringify({ error: "Password required to edit this list" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get all bought items
      const { data: boughtItems, error: fetchError } = await supabaseClient
        .from("items")
        .select("*")
        .eq("list_id", list_id)
        .eq("is_bought", true);

      if (fetchError) {
        console.error("Fetch error:", fetchError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch bought items" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!boughtItems || boughtItems.length === 0) {
        return new Response(
          JSON.stringify({ error: "No bought items to archive" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create archive entry
      const { data: archive, error: archiveError } = await supabaseClient
        .from("archives")
        .insert({
          list_id,
          items: boughtItems,
          archived_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (archiveError) {
        console.error("Archive error:", archiveError);
        return new Response(
          JSON.stringify({ error: "Failed to create archive" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete bought items from items table
      const { error: deleteError } = await supabaseClient
        .from("items")
        .delete()
        .eq("list_id", list_id)
        .eq("is_bought", true);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete bought items" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          archive,
          undo_data: { type: "archive", items: boughtItems }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle DELETE_BOUGHT action
    if (action === "delete_bought") {
      const { list_id } = body as DeleteBoughtRequest;

      if (!list_id) {
        return new Response(
          JSON.stringify({ error: "List ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hasPermission = await checkEditPermission(list_id);
      if (!hasPermission) {
        return new Response(
          JSON.stringify({ error: "Password required to edit this list" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get bought items first (for undo)
      const { data: boughtItems } = await supabaseClient
        .from("items")
        .select("*")
        .eq("list_id", list_id)
        .eq("is_bought", true);

      // Delete bought items
      const { error: deleteError } = await supabaseClient
        .from("items")
        .delete()
        .eq("list_id", list_id)
        .eq("is_bought", true);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete bought items" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          deleted_count: boughtItems?.length || 0,
          undo_data: { type: "delete_bought", items: boughtItems || [] }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle DELETE_ALL action
    if (action === "delete_all") {
      const { list_id } = body as DeleteAllRequest;

      if (!list_id) {
        return new Response(
          JSON.stringify({ error: "List ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hasPermission = await checkEditPermission(list_id);
      if (!hasPermission) {
        return new Response(
          JSON.stringify({ error: "Password required to edit this list" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get all items first (for undo)
      const { data: allItems } = await supabaseClient
        .from("items")
        .select("*")
        .eq("list_id", list_id);

      // Delete all items
      const { error: deleteError } = await supabaseClient
        .from("items")
        .delete()
        .eq("list_id", list_id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete items" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          deleted_count: allItems?.length || 0,
          undo_data: { type: "delete_all", items: allItems || [] }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle GET_ARCHIVES action
    if (action === "get_archives") {
      const { list_id } = body as GetArchivesRequest;

      if (!list_id) {
        return new Response(
          JSON.stringify({ error: "List ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: archives, error: fetchError } = await supabaseClient
        .from("archives")
        .select("*")
        .eq("list_id", list_id)
        .order("archived_at", { ascending: false });

      if (fetchError) {
        console.error("Fetch error:", fetchError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch archives" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ archives: archives || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle DELETE_ARCHIVE action
    if (action === "delete_archive") {
      const { archive_id, list_id } = body as DeleteArchiveRequest;

      if (!archive_id || !list_id) {
        return new Response(
          JSON.stringify({ error: "Archive ID and List ID are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hasPermission = await checkEditPermission(list_id);
      if (!hasPermission) {
        return new Response(
          JSON.stringify({ error: "Password required to edit this list" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get archive first (for undo)
      const { data: archive } = await supabaseClient
        .from("archives")
        .select("*")
        .eq("id", archive_id)
        .single();

      // Delete the archive
      const { error: deleteError } = await supabaseClient
        .from("archives")
        .delete()
        .eq("id", archive_id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete archive" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          undo_data: { type: "delete_archive", archive }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle UNDO action
    if (action === "undo") {
      const { list_id, undo_data } = body as UndoRequest;

      if (!list_id || !undo_data) {
        return new Response(
          JSON.stringify({ error: "List ID and undo data are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hasPermission = await checkEditPermission(list_id);
      if (!hasPermission) {
        return new Response(
          JSON.stringify({ error: "Password required to edit this list" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (undo_data.type === "archive" && undo_data.items) {
        // Restore items and delete the archive
        const itemsToRestore = undo_data.items.map((item: any) => ({
          id: item.id,
          list_id: item.list_id,
          name: item.name,
          amount: item.amount,
          type: item.type,
          note: item.note,
          is_bought: item.is_bought,
          created_at: item.created_at,
        }));

        const { error: insertError } = await supabaseClient
          .from("items")
          .upsert(itemsToRestore);

        if (insertError) {
          console.error("Insert error:", insertError);
          return new Response(
            JSON.stringify({ error: "Failed to restore items" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Delete the most recent archive for this list
        const { data: latestArchive } = await supabaseClient
          .from("archives")
          .select("id")
          .eq("list_id", list_id)
          .order("archived_at", { ascending: false })
          .limit(1)
          .single();

        if (latestArchive) {
          await supabaseClient
            .from("archives")
            .delete()
            .eq("id", latestArchive.id);
        }

        return new Response(
          JSON.stringify({ success: true, restored_count: itemsToRestore.length }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if ((undo_data.type === "delete_bought" || undo_data.type === "delete_all") && undo_data.items) {
        // Restore deleted items
        const itemsToRestore = undo_data.items.map((item: any) => ({
          id: item.id,
          list_id: item.list_id,
          name: item.name,
          amount: item.amount,
          type: item.type,
          note: item.note,
          is_bought: item.is_bought,
          created_at: item.created_at,
        }));

        const { error: insertError } = await supabaseClient
          .from("items")
          .upsert(itemsToRestore);

        if (insertError) {
          console.error("Insert error:", insertError);
          return new Response(
            JSON.stringify({ error: "Failed to restore items" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, restored_count: itemsToRestore.length }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (undo_data.type === "delete_archive" && undo_data.archive) {
        // Restore the archive
        const { error: insertError } = await supabaseClient
          .from("archives")
          .insert({
            id: undo_data.archive.id,
            list_id: undo_data.archive.list_id,
            items: undo_data.archive.items,
            archived_at: undo_data.archive.archived_at,
            created_at: undo_data.archive.created_at,
          });

        if (insertError) {
          console.error("Insert error:", insertError);
          return new Response(
            JSON.stringify({ error: "Failed to restore archive" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Invalid undo data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
