import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getMediaDetail } from "@/features/media/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";
import { RegenerateButton } from "./regenerate-button";

export const dynamic = "force-dynamic";

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={i} className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
          {item}
        </span>
      ))}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="rounded-md border bg-background p-3 text-sm">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function MediaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getMediaDetail(id);
  if (!detail) notFound();

  const { media, analysis, intelligence } = detail;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/media"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to library
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{media.file_name}</h1>
          <p className="text-sm text-muted-foreground">
            {media.folder_label ?? media.kind} · {media.status}
            {media.duration_sec ? ` · ${formatDuration(media.duration_sec)}` : ""}
          </p>
        </div>
        <RegenerateButton mediaId={media.id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {analysis ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Category" value={analysis.category ?? "—"} />
                <Stat label="Mood" value={analysis.mood ?? "—"} />
                <Stat
                  label="Quality"
                  value={analysis.quality_score != null ? `${analysis.quality_score}/100` : "—"}
                />
                <Stat
                  label="Viral score"
                  value={analysis.viral_score != null ? `${analysis.viral_score}/100` : "—"}
                />
              </div>
              <div>
                <p className="mb-2 font-medium">Keywords</p>
                <Chips items={analysis.keywords} />
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              Not analyzed yet. The worker analyzes ingested media automatically.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generated content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {intelligence ? (
            <>
              <Section title="Titles">
                <List items={intelligence.titles} />
              </Section>
              <Section title="Hooks">
                <List items={intelligence.hooks} />
              </Section>
              <Section title="Captions">
                <List items={intelligence.captions} />
              </Section>
              <Section title="Hashtags">
                <Chips items={intelligence.hashtags} />
              </Section>
              <Section title="Call-to-actions">
                <List items={intelligence.ctas} />
              </Section>
              <Section title="Recommended platforms">
                <Chips items={intelligence.recommended_platforms} />
              </Section>
              {intelligence.target_audience && (
                <Section title="Target audience">
                  <p className="text-sm">{intelligence.target_audience}</p>
                </Section>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No generated content yet. Use “Regenerate” above, or let the worker produce it after
              analysis.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-medium">{title}</p>
      {children}
    </div>
  );
}
