"use client";

import { Send } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { askAssistantAction, type AssistantState } from "./actions";
import { Button } from "@/components/ui/button";

const initial: AssistantState = {};

const SUGGESTIONS = [
  "Which videos have never been published?",
  "What should I post tomorrow?",
  "What content gaps do I have?",
  "Show me all drone footage",
  "How is my engagement doing?",
];

export function ChatInput({ conversationId }: { conversationId: string }) {
  const [state, formAction, pending] = useActionState(askAssistantAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Clear the input once a send completes without error.
  useEffect(() => {
    if (!pending && !state.error && inputRef.current) inputRef.current.value = "";
  }, [pending, state.error]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = s;
            }}
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            {s}
          </button>
        ))}
      </div>
      <form ref={formRef} action={formAction} className="flex items-end gap-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <textarea
          ref={inputRef}
          name="message"
          rows={2}
          placeholder="Ask about your content, schedule, analytics, or competitors…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
        <Button type="submit" disabled={pending} aria-label="Send">
          <Send className="h-4 w-4" />
          {pending ? "Thinking…" : "Ask"}
        </Button>
      </form>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  );
}
