import { createClient } from "@/lib/supabase/server";
import { listSocialAccounts } from "@/features/social/accounts";
import { listRecentMedia } from "@/features/media/queries";
import {
  listUpcomingPosts,
  listDraftPosts,
  listPostsInRange,
  type PostListItem,
} from "@/features/posts/queries";
import { PLATFORM_LABELS } from "@/lib/social/platforms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposeForm, type ComposeAccount, type ComposeMedia } from "./compose-form";
import { MonthView } from "./month-view";
import { publishNowAction, cancelScheduleAction, deletePostAction } from "./actions";

export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusPill({ status }: { status: PostListItem["status"] }) {
  const tone: Record<string, string> = {
    draft: "bg-secondary text-secondary-foreground",
    scheduled: "bg-primary/10 text-primary",
    publishing: "bg-primary/10 text-primary",
    published: "bg-emerald-500/15 text-emerald-500",
    failed: "bg-destructive/15 text-destructive",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone[status] ?? ""}`}>
      {status}
    </span>
  );
}

function PostRow({ post }: { post: PostListItem }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{PLATFORM_LABELS[post.platform]}</span>
          <StatusPill status={post.status} />
          {post.scheduled_for && (
            <span className="text-xs text-muted-foreground">{fmt(post.scheduled_for)}</span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{post.caption || "(no caption)"}</p>
        {post.error && <p className="mt-1 text-xs text-destructive">{post.error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        {post.status !== "publishing" && post.status !== "published" && (
          <form action={publishNowAction}>
            <input type="hidden" name="postId" value={post.id} />
            <button className="text-primary underline underline-offset-2">publish now</button>
          </form>
        )}
        {post.status === "scheduled" && (
          <form action={cancelScheduleAction}>
            <input type="hidden" name="postId" value={post.id} />
            <button className="text-muted-foreground underline underline-offset-2">unschedule</button>
          </form>
        )}
        <form action={deletePostAction}>
          <input type="hidden" name="postId" value={post.id} />
          <button className="text-destructive underline underline-offset-2">delete</button>
        </form>
      </div>
    </div>
  );
}

export default async function CalendarPage() {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [accountsRaw, mediaRaw, upcoming, drafts, monthPosts] = await Promise.all([
    listSocialAccounts(supabase),
    listRecentMedia(50),
    listUpcomingPosts(),
    listDraftPosts(),
    listPostsInRange(monthStart.toISOString(), monthEnd.toISOString()),
  ]);

  const accounts: ComposeAccount[] = accountsRaw
    .filter((a) => a.status === "connected")
    .map((a) => ({ id: a.id, platform: a.platform, label: a.display_name ?? a.username ?? "account" }));
  const media: ComposeMedia[] = mediaRaw.map((m) => ({
    id: m.id,
    file_name: m.file_name,
    kind: m.kind,
    duration_sec: m.duration_sec,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scheduler</h1>
        <p className="text-sm text-muted-foreground">
          Compose, schedule, and publish. Nothing goes out without you.
        </p>
      </div>

      <ComposeForm accounts={accounts} media={media} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {now.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MonthView posts={monthPosts} month={now} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
          ) : (
            upcoming.map((p) => <PostRow key={p.id} post={p} />)
          )}
        </CardContent>
      </Card>

      {drafts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Drafts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {drafts.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
