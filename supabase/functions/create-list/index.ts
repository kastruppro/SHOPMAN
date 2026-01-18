// Supabase Edge Function: create-list
// Creates a new shopping list with optional password protection

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateListRequest {
  name: string;
  password?: string | null;
  view_requires_password?: boolean;
  edit_requires_password?: boolean;
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

    const { name, password, view_requires_password, edit_requires_password }: CreateListRequest = await req.json();

    // Validate input
    if (!name || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "List name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (name.length > 100) {
      return new Response(
        JSON.stringify({ error: "List name must be 100 characters or less" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nameLowercase = name.toLowerCase().trim();

    // Check if list already exists
    const { data: existingList } = await supabaseClient
      .from("lists")
      .select("id")
      .eq("name_lowercase", nameLowercase)
      .single();

    if (existingList) {
      return new Response(
        JSON.stringify({ error: "A list with this name already exists" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash password if provided
    let passwordHash: string | null = null;
    if (password && password.length > 0) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }

    // Create the list
    const { data: newList, error: insertError } = await supabaseClient
      .from("lists")
      .insert({
        name: name.trim(),
        name_lowercase: nameLowercase,
        password_hash: passwordHash,
        view_requires_password: password ? (view_requires_password ?? false) : false,
        edit_requires_password: password ? (edit_requires_password ?? true) : false,
      })
      .select("id, name, name_lowercase, view_requires_password, edit_requires_password, created_at")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create list" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(newList),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
