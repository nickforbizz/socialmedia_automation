import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, LayoutGrid } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPendingPages } from "@/features/social/accounts";
import { isSocialPlatform, PLATFORM_LABELS } from "@/lib/social/platforms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { selectPageAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PageSelectionPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  const { platform } = await searchParams;
  if (!platform || !isSocialPlatform(platform)) notFound();

  const supabase = await createClient();
  const pending = await getPendingPages(supabase, platform);
  const label = PLATFORM_LABELS[platform];
  const noun = platform === "instagram" ? "account" : "page";

  const done = !pending || pending.pages.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a {label} {noun}</h1>
        <p className="text-sm text-muted-foreground">
          {done
            ? `All set — no more ${noun}s waiting to connect.`
            : `Select which ${label} ${noun}${pending!.pages.length > 1 ? "s" : ""} to connect. You can add more than one.`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutGrid className="h-4 w-4 text-primary" /> Available {noun}s
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">Every page has been connected.</p>
              <Link href="/settings" className={buttonVariants({ variant: "default", size: "sm" })}>
                Back to settings
              </Link>
            </div>
          ) : (
            pending!.pages.map((page) => (
              <div key={page.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-medium">{page.name}</p>
                  {page.category && (
                    <p className="text-xs text-muted-foreground">{page.category}</p>
                  )}
                </div>
                <form action={selectPageAction}>
                  <input type="hidden" name="platform" value={platform} />
                  <input type="hidden" name="pageId" value={page.id} />
                  <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Connect
                  </button>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Link href="/settings" className="text-sm text-muted-foreground underline underline-offset-2">
        Skip for now
      </Link>
    </div>
  );
}
