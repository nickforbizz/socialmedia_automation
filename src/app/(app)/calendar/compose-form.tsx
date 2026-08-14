"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { composePostAction, type ComposeState } from "./actions";
import { recommendSchedule, nextOccurrence } from "@/features/posts/recommend";
import { PLATFORM_LABELS } from "@/lib/social/platforms";
import type { SocialPlatform } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ComposeAccount {
  id: string;
  platform: SocialPlatform;
  label: string;
}
export interface ComposeMedia {
  id: string;
  file_name: string;
  kind: "video" | "image" | "audio";
  duration_sec: number | null;
}

const initial: ComposeState = {};

/** Format a Date for a <input type="datetime-local"> value (local time). */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ComposeForm({
  accounts,
  media,
}: {
  accounts: ComposeAccount[];
  media: ComposeMedia[];
}) {
  const [state, formAction, pending] = useActionState(composePostAction, initial);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [mediaId, setMediaId] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId],
  );

  function suggestTime() {
    const m = media.find((x) => x.id === mediaId);
    const rec = recommendSchedule({
      mediaKind: m?.kind ?? null,
      durationSec: m?.duration_sec ?? null,
      recommendedPlatforms: selectedAccount ? [selectedAccount.platform] : undefined,
    });
    const when = nextOccurrence(rec.dayOfWeek, rec.hourLocal);
    setScheduledFor(toLocalInput(when));
    setSuggestion(
      `${rec.dayLabel} ${rec.timeLabel} · est. ${rec.estimatedEngagement} engagement — ${rec.rationale}`,
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Connect a social account in{" "}
          <a href="/settings" className="underline underline-offset-2">
            Settings
          </a>{" "}
          before composing a post.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Compose</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="socialAccountId">Account</Label>
              <select
                id="socialAccountId"
                name="socialAccountId"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {PLATFORM_LABELS[a.platform]} · {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mediaId">Media (optional)</Label>
              <select
                id="mediaId"
                name="mediaId"
                value={mediaId}
                onChange={(e) => setMediaId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— none —</option>
                {media.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.file_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <textarea
              id="caption"
              name="caption"
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Write your caption…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hashtags">Hashtags</Label>
            <Input id="hashtags" name="hashtags" placeholder="#kilifi #beach #travel" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="scheduledFor">Schedule for</Label>
              <button
                type="button"
                onClick={suggestTime}
                className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
              >
                <Sparkles className="h-3.5 w-3.5" /> Suggest best time
              </button>
            </div>
            <Input
              id="scheduledFor"
              name="scheduledFor"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
            {suggestion && <p className="text-xs text-muted-foreground">{suggestion}</p>}
            {selectedAccount?.platform === "facebook" && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="nativeSchedule" value="on" className="h-3.5 w-3.5" />
                Let Facebook hold the schedule (more reliable; text/link posts, ≥10 min ahead)
              </label>
            )}
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.ok && <p className="text-sm text-muted-foreground">Saved.</p>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="intent" value="publish_now" disabled={pending}>
              Publish now
            </Button>
            <Button type="submit" name="intent" value="schedule" variant="secondary" disabled={pending}>
              Schedule
            </Button>
            <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
              Save draft
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
