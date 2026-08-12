import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { clientEnv, getServerEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role client. BYPASSES RLS — use ONLY in trusted server contexts
 * (background worker, ingestion). Never import into anything reachable by the
 * browser. The "server-only" import throws if that is attempted.
 */
export function createAdminClient() {
  const env = getServerEnv();
  return createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
