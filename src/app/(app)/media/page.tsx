import Link from "next/link";
import { Film, ImageIcon, Music, FolderOpen, SearchX } from "lucide-react";
import { listRecentMedia, type MediaListItem } from "@/features/media/queries";
import { semanticSearch } from "@/features/search/semantic";
import { Card, CardContent } from "@/components/ui/card";
import { formatBytes, formatDuration } from "@/lib/utils";
import { SearchBar } from "./search-bar";

export const dynamic = "force-dynamic";

const KIND_ICON = { video: Film, image: ImageIcon, audio: Music } as const;

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <FolderOpen className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">No media yet</p>
          <p className="text-sm text-muted-foreground">
            Configure watch folders in <code>MEDIA_WATCH_FOLDERS</code> and run{" "}
            <code>npm run worker</code> to ingest your files.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <SearchX className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">No matches for “{query}”</p>
          <p className="text-sm text-muted-foreground">
            Only analyzed media is searchable. Run the worker so items get embeddings.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MediaCard({ item, similarity }: { item: MediaListItem; similarity?: number }) {
  const Icon = KIND_ICON[item.kind];
  return (
    <Link href={`/media/${item.id}`} className="group">
      <Card className="overflow-hidden transition-colors group-hover:border-primary/40">
        <div className="relative flex aspect-video items-center justify-center bg-muted">
          <Icon className="h-8 w-8 text-muted-foreground" />
          {typeof similarity === "number" && (
            <span className="absolute right-2 top-2 rounded bg-background/80 px-1.5 py-0.5 text-xs font-medium">
              {Math.round(similarity * 100)}% match
            </span>
          )}
        </div>
        <CardContent className="space-y-1 p-3">
          <p className="truncate text-sm font-medium" title={item.file_name}>
            {item.file_name}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{item.folder_label ?? item.kind}</span>
            <span>
              {item.duration_sec
                ? formatDuration(item.duration_sec)
                : item.size_bytes
                  ? formatBytes(item.size_bytes)
                  : ""}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const results = query ? await semanticSearch(query) : null;
  const recent = query ? [] : await listRecentMedia();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Media Library</h1>
        <p className="text-sm text-muted-foreground">
          {query ? `Semantic results for “${query}”` : "Ingested from your local folders."}
        </p>
      </div>

      <SearchBar initialQuery={query} />

      {query ? (
        results && results.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {results.map((r) => (
              <MediaCard key={r.id} item={r} similarity={r.similarity} />
            ))}
          </div>
        ) : (
          <NoResults query={query} />
        )
      ) : recent.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {recent.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
