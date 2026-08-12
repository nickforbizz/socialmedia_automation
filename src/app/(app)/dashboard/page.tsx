import { Suspense } from "react";
import { Film, CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import { getMediaStats } from "@/features/media/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function StatSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/40" />
      ))}
    </div>
  );
}

async function Stats() {
  const stats = await getMediaStats();
  const cards = [
    { label: "Total media", value: stats.total, icon: Film },
    { label: "Ready", value: stats.ready, icon: CheckCircle2 },
    { label: "Analyzed", value: stats.analyzed, icon: Sparkles },
    { label: "Ingesting", value: stats.ingesting, icon: Loader2 },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your local media, analyzed and ready to publish.
        </p>
      </div>
      <Suspense fallback={<StatSkeleton />}>
        <Stats />
      </Suspense>
    </div>
  );
}
