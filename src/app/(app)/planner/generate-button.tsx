"use client";

import { Sparkles } from "lucide-react";
import { useActionState } from "react";
import { generatePlanAction, type PlanState } from "./actions";
import { Button } from "@/components/ui/button";

const initial: PlanState = {};

export function GenerateButton() {
  const [state, formAction, pending] = useActionState(generatePlanAction, initial);
  return (
    <form action={formAction} className="flex items-center gap-3">
      <Button type="submit" disabled={pending}>
        <Sparkles className={pending ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
        {pending ? "Planning…" : "Generate next week"}
      </Button>
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
      {state.ok && <span className="text-sm text-muted-foreground">{state.message}</span>}
    </form>
  );
}
