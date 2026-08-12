import { CheckCircle2, Plug, AlertTriangle, Beaker } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listSocialAccounts, type AccountSummary } from "@/features/social/accounts";
import { SOCIAL_PLATFORMS, PLATFORM_LABELS } from "@/lib/social/platforms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { disconnectAccountAction } from "./actions";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_state: "Connection could not be verified (state mismatch). Please try again.",
  connect_failed: "Connecting the account failed. Check the platform credentials and try again.",
  no_encryption_key: "TOKEN_ENCRYPTION_KEY is not set — add it to .env.local to connect accounts.",
  unknown_platform: "Unknown platform.",
  connect_start_failed: "Could not start the connection. Please try again.",
};

function Banner({ connected, error }: { connected?: string; error?: string }) {
  if (connected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        Connected {PLATFORM_LABELS[connected as keyof typeof PLATFORM_LABELS] ?? connected}.
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4" />
        {ERROR_MESSAGES[error] ?? "Something went wrong."}
      </div>
    );
  }
  return null;
}

function accountsByPlatform(accounts: AccountSummary[]) {
  const map = new Map<string, AccountSummary[]>();
  for (const a of accounts) {
    const list = map.get(a.platform) ?? [];
    list.push(a);
    map.set(a.platform, list);
  }
  return map;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const supabase = await createClient();
  const accounts = await listSocialAccounts(supabase);
  const byPlatform = accountsByPlatform(accounts);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Connect the accounts you publish to.</p>
      </div>

      <Banner connected={connected} error={error} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {SOCIAL_PLATFORMS.map((platform) => {
            const connectedAccounts = byPlatform.get(platform) ?? [];
            return (
              <div
                key={platform}
                className="flex items-center justify-between gap-4 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{PLATFORM_LABELS[platform]}</p>
                  {connectedAccounts.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {connectedAccounts.map((a) => (
                        <li key={a.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          <span className="truncate">{a.display_name ?? a.username ?? a.id}</span>
                          {a.is_mock && (
                            <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs">
                              <Beaker className="h-3 w-3" /> mock
                            </span>
                          )}
                          <span className="text-xs">· {a.status}</span>
                          <form action={disconnectAccountAction} className="ml-1">
                            <input type="hidden" name="accountId" value={a.id} />
                            <button
                              type="submit"
                              className="text-xs text-destructive underline underline-offset-2"
                            >
                              disconnect
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not connected</p>
                  )}
                </div>
                <a
                  href={`/api/social/${platform}/connect`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Plug className="h-4 w-4" />
                  {connectedAccounts.length > 0 ? "Add another" : "Connect"}
                </a>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
