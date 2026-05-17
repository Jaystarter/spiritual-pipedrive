import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

export function createSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
