"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabaseKey, supabaseUrl } from "./env";

// Browser client, for direct calls from Client Components (e.g. uploading a
// file to Storage without routing the bytes through a Server Action). It
// shares the same auth cookies as the server client, so it acts as the same
// signed-in user and is bound by the same RLS policies.
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
