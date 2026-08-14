import Link from "next/link";
import { CalendarClock, Sparkles } from "lucide-react";
import { listDraftPosts } from "@/features/posts/queries";
import { PLATFORM_LABELS } from "@/lib/social/platforms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateButton } from "./generate-button";

export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "no time set";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function PlannerPage() {
  const drafts = await listDraftPosts(100);
  const withTime = drafts.filter((d) => d.scheduled_for);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Content Planner</h1>
          <p className="text-sm text-muted-foreground">
            Auto-generate next week from your analyzed footage. Everything lands as an editable draft.
          </p>
        </div>
        <GenerateButton />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <CalendarClock className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Planned drafts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {drafts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No drafts yet. Click “Generate next week” to build a plan from your analyzed media.
              </p>
            </div>
          ) : (
            <>
              {(withTime.length ? withTime : drafts).map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{PLATFORM_LABELS[d.platform]}</span>
                      {d.scheduled_for && (
                        <span className="text-xs text-muted-foreground">suggested {fmt(d.scheduled_for)}</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {d.caption || "(caption to be written)"}
                    </p>
                  </div>
                </div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                Review and schedule these from the{" "}
                <Link href="/calendar" className="underline underline-offset-2">
                  Scheduler
                </Link>
                .
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
