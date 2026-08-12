"use client";

import { RefreshCw } from "lucide-react";
import { useActionState } from "react";
import { regenerateIntelligenceAction, type RegenerateState } from "../actions";
import { Button } from "@/components/ui/button";

const initial: RegenerateState = {};

export function RegenerateButton({ mediaId }: { mediaId: string }) {
  const [state, formAction, pending] = useActionState(regenerateIntelligenceAction, initial);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="mediaId" value={mediaId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {pending ? "Generating…" : "Regenerate"}
      </Button>
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
      {state.ok && <span className="text-sm text-muted-foreground">Updated.</span>}
    </form>
  );
}
