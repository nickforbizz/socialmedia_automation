"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";
import { addCompetitorAction, type AddCompetitorState } from "./actions";
import { SOCIAL_PLATFORMS, PLATFORM_LABELS } from "@/lib/social/platforms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: AddCompetitorState = {};

export function AddCompetitorForm() {
  const [state, formAction, pending] = useActionState(addCompetitorAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="mb-1 block text-xs text-muted-foreground" htmlFor="platform">
          Platform
        </label>
        <select
          id="platform"
          name="platform"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue="instagram"
        >
          {SOCIAL_PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABELS[p]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-[2]">
        <label className="mb-1 block text-xs text-muted-foreground" htmlFor="handle">
          Handle / username
        </label>
        <Input id="handle" name="handle" placeholder="@competitor" />
      </div>
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "Adding…" : "Add"}
      </Button>
      {state.error && <p className="text-sm text-destructive sm:self-center">{state.error}</p>}
    </form>
  );
}
