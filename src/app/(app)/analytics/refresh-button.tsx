"use client";

import { RefreshCw } from "lucide-react";
import { useActionState } from "react";
import { refreshMetricsAction, type RefreshState } from "./actions";
import { Button } from "@/components/ui/button";

const initial: RefreshState = {};

export function RefreshButton() {
  const [state, formAction, pending] = useActionState(refreshMetricsAction, initial);
  return (
    <form action={formAction} className="flex items-center gap-3">
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {pending ? "Refreshing…" : "Refresh metrics"}
      </Button>
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
      {state.ok && <span className="text-sm text-muted-foreground">{state.message}</span>}
    </form>
  );
}
