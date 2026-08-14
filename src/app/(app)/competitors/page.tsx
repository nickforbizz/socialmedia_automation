import { Users, RefreshCw, Trash2, Lightbulb, Hash, Clock, Beaker } from "lucide-react";
import { getCompetitorIntelligence } from "@/features/competitors/queries";
import { suggestContentIdeas } from "@/features/competitors/opportunities-ai";
import { PLATFORM_LABELS } from "@/lib/social/platforms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddCompetitorForm } from "./add-form";
import { syncCompetitorAction, removeCompetitorAction } from "./actions";

export const dynamic = "force-dynamic";

const OPP_LABEL: Record<string, string> = {
  untapped_footage: "You have footage",
  content_gap: "Content gap",
  covered: "Covered",
};

export default async function CompetitorsPage() {
  const intel = await getCompetitorIntelligence();
  const ideas = intel.hasPosts
    ? await suggestContentIdeas(intel.opportunities, intel.userMediaThemes)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Competitor intelligence</h1>
        <p className="text-sm text-muted-foreground">
          Monitor public accounts for inspiration — then post your own original take.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Track a competitor</CardTitle>
        </CardHeader>
        <CardContent>
          <AddCompetitorForm />
        </CardContent>
      </Card>

      {intel.opportunities.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Lightbulb className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Content opportunities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ideas.length > 0 && (
              <div className="rounded-md border bg-primary/5 p-3">
                <p className="mb-2 text-xs font-medium text-primary">AI ideas from your own footage</p>
                <ul className="space-y-1.5 text-sm">
                  {ideas.map((idea, i) => (
                    <li key={i}>• {idea}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-2">
              {intel.opportunities.map((o) => (
                <div key={o.topic} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{o.topic}</span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                        {OPP_LABEL[o.type]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{o.rationale}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {o.competitorAvgEngagement.toLocaleString()} avg
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {intel.competitors.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Users className="h-9 w-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No competitors yet. Add a handle above to start gathering inspiration.
              </p>
            </CardContent>
          </Card>
        ) : (
          intel.competitors.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  {PLATFORM_LABELS[c.platform]} · @{c.handle}
                  {c.isMock && (
                    <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs font-normal">
                      <Beaker className="h-3 w-3" /> mock
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <form action={syncCompetitorAction}>
                    <input type="hidden" name="competitorId" value={c.id} />
                    <button className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2">
                      <RefreshCw className="h-3.5 w-3.5" /> sync
                    </button>
                  </form>
                  <form action={removeCompetitorAction}>
                    <input type="hidden" name="competitorId" value={c.id} />
                    <button className="inline-flex items-center gap-1 text-xs text-destructive underline underline-offset-2">
                      <Trash2 className="h-3.5 w-3.5" /> remove
                    </button>
                  </form>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {c.postCount === 0 ? (
                  <p className="text-muted-foreground">No posts synced yet. Click “sync”.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Stat label="Posts/week" value={String(c.analysis.postsPerWeek)} />
                      <Stat label="Avg engagement" value={c.analysis.avgEngagement.toLocaleString()} />
                      <Stat
                        label="Avg video"
                        value={c.analysis.avgVideoLengthSec ? `${c.analysis.avgVideoLengthSec}s` : "—"}
                      />
                      <Stat label="Posts synced" value={String(c.postCount)} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      {c.analysis.topHashtags.slice(0, 6).map((h) => (
                        <span key={h.key} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                          {h.key} ({h.count})
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Posts most at{" "}
                      {c.analysis.bestHours.map((h) => `${h.key}:00`).join(", ") || "—"}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
