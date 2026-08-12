import type { PostListItem } from "@/features/posts/queries";
import { PLATFORM_LABELS } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

/**
 * Read-only month grid showing scheduled/published posts on their day.
 * (Drag-and-drop rescheduling is a planned enhancement; this establishes the
 * month view and the data plumbing.)
 */
export function MonthView({ posts, month }: { posts: PostListItem[]; month: Date }) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const startOffset = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const today = new Date();

  const byDay = new Map<number, PostListItem[]>();
  for (const p of posts) {
    if (!p.scheduled_for) continue;
    const d = new Date(p.scheduled_for);
    if (d.getFullYear() === year && d.getMonth() === m) {
      const day = d.getDate();
      const list = byDay.get(day) ?? [];
      list.push(p);
      byDay.set(day, list);
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {weekdays.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const isToday =
            day != null &&
            today.getFullYear() === year &&
            today.getMonth() === m &&
            today.getDate() === day;
          const dayPosts = day != null ? (byDay.get(day) ?? []) : [];
          return (
            <div
              key={i}
              className={cn(
                "min-h-20 rounded-md border p-1 text-xs",
                day == null && "border-transparent bg-transparent",
                isToday && "border-primary/50",
              )}
            >
              {day != null && (
                <>
                  <div className={cn("mb-1 font-medium", isToday && "text-primary")}>{day}</div>
                  <div className="space-y-1">
                    {dayPosts.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        title={p.caption}
                        className="truncate rounded bg-secondary px-1 py-0.5 text-secondary-foreground"
                      >
                        {PLATFORM_LABELS[p.platform]}
                        {p.status === "published" ? " ✓" : ""}
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <div className="text-muted-foreground">+{dayPosts.length - 3} more</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
