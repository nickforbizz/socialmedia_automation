import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";
import { encryptToken, decryptToken } from "@/lib/crypto/tokens";
import { getSocialProvider } from "@/lib/social/registry";
import { logger } from "@/lib/logger";
import type { Database, SocialPlatform } from "@/lib/supabase/database.types";
import type { ConnectResult } from "@/lib/social/types";

type DB = SupabaseClient<Database>;

/** Public-safe view of a connected account (never exposes token ciphertext). */
export interface AccountSummary {
  id: string;
  platform: SocialPlatform;
  display_name: string | null;
  username: string | null;
  status: Database["public"]["Tables"]["social_accounts"]["Row"]["status"];
  is_mock: boolean;
  token_expires_at: string | null;
  last_checked_at: string | null;
}

export class SocialAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialAccountError";
  }
}

function requireKey(): string {
  const key = getServerEnv().TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new SocialAccountError(
      "TOKEN_ENCRYPTION_KEY is not set. Generate one (openssl rand -base64 32) and add it to .env.local.",
    );
  }
  return key;
}

/** Find the caller's first project, creating a default one if needed. */
export async function getOrCreateDefaultProject(db: DB, ownerId: string): Promise<string> {
  const { data: existing } = await db
    .from("projects")
    .select("id")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await db
    .from("projects")
    .insert({ owner_id: ownerId, name: "My Project" })
    .select("id")
    .single();
  if (error || !created) throw new SocialAccountError(`Could not create project: ${error?.message}`);
  return created.id;
}

/** Persist a freshly connected account with encrypted tokens. */
export async function upsertConnectedAccount(
  db: DB,
  params: {
    ownerId: string;
    projectId: string;
    platform: SocialPlatform;
    isMock: boolean;
    result: ConnectResult;
  },
): Promise<string> {
  const key = requireKey();
  const { result } = params;

  const { data, error } = await db
    .from("social_accounts")
    .upsert(
      {
        owner_id: params.ownerId,
        project_id: params.projectId,
        platform: params.platform,
        external_account_id: result.externalAccountId,
        display_name: result.displayName ?? null,
        username: result.username ?? null,
        avatar_url: result.avatarUrl ?? null,
        access_token_cipher: encryptToken(result.accessToken, key),
        refresh_token_cipher: result.refreshToken ? encryptToken(result.refreshToken, key) : null,
        token_expires_at: result.expiresAt ?? null,
        scopes: result.scopes ?? [],
        status: "connected",
        is_mock: params.isMock,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,platform,external_account_id" },
    )
    .select("id")
    .single();
  if (error || !data) throw new SocialAccountError(`Failed to save account: ${error?.message}`);
  return data.id;
}

export async function listSocialAccounts(db: DB): Promise<AccountSummary[]> {
  const { data, error } = await db
    .from("social_accounts")
    .select("id, platform, display_name, username, status, is_mock, token_expires_at, last_checked_at")
    .order("created_at", { ascending: true });
  if (error) throw new SocialAccountError(`Failed to load accounts: ${error.message}`);
  return data ?? [];
}

export async function disconnectAccount(db: DB, accountId: string): Promise<void> {
  const { error } = await db.from("social_accounts").delete().eq("id", accountId);
  if (error) throw new SocialAccountError(`Failed to disconnect: ${error.message}`);
}

/**
 * Return a usable access token for an account, transparently refreshing (and
 * re-encrypting) if it has expired and a refresh token is available.
 */
export async function getAccessTokenForAccount(
  db: DB,
  accountId: string,
): Promise<{ accessToken: string; platform: SocialPlatform; externalAccountId: string }> {
  const key = requireKey();
  const { data: acct, error } = await db
    .from("social_accounts")
    .select(
      "id, platform, external_account_id, access_token_cipher, refresh_token_cipher, token_expires_at, is_mock",
    )
    .eq("id", accountId)
    .single();
  if (error || !acct) throw new SocialAccountError(`Account not found: ${accountId}`);
  if (!acct.access_token_cipher) throw new SocialAccountError("Account has no stored token.");

  const expired =
    acct.token_expires_at != null && new Date(acct.token_expires_at).getTime() < Date.now() + 60_000;

  if (expired && acct.refresh_token_cipher) {
    const provider = getSocialProvider(acct.platform);
    const refreshed = await provider.refresh(decryptToken(acct.refresh_token_cipher, key));
    await db
      .from("social_accounts")
      .update({
        access_token_cipher: encryptToken(refreshed.accessToken, key),
        token_expires_at: refreshed.expiresAt ?? null,
        status: "connected",
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", accountId);
    logger.info("social token refreshed", { accountId, platform: acct.platform });
    return {
      accessToken: refreshed.accessToken,
      platform: acct.platform,
      externalAccountId: acct.external_account_id,
    };
  }

  return {
    accessToken: decryptToken(acct.access_token_cipher, key),
    platform: acct.platform,
    externalAccountId: acct.external_account_id,
  };
}
