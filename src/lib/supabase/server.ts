import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { clientEnv } from "@/lib/env";
import type { Database } from "./database.types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Server-side Supabase client bound to the request cookie jar.
 * Use inside Server Components, Server Actions, and Route Handlers.
 * RLS is enforced — this acts as the signed-in user.
 *
 * The return type is pinned to supabase-js's `SupabaseClient<Database>`. The
 * `@supabase/ssr` `createServerClient` generic instantiates the client's schema
 * type parameters differently from supabase-js, which otherwise degrades typed
 * `.from()`/`.rpc()` calls to `never`. Runtime behaviour is identical; this only
 * bridges the generic mismatch so the rest of the app is strongly typed.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` is called from a Server Component render, where cookies
            // are read-only. Safe to ignore when middleware refreshes sessions.
          }
        },
      },
    },
  ) as unknown as SupabaseClient<Database>;
}
