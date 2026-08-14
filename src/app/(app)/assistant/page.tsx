import { Bot, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ChatInput } from "./chat-input";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const supabase = await createClient();

  // Continue the most recent conversation (memory persists across visits).
  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: messages } = conversation
    ? await supabase
        .from("ai_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask about your media, schedule, analytics, and competitors — answers are grounded in your
          own data.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border p-4">
        {(messages ?? []).length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Bot className="h-9 w-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Ask a question below, or tap a suggestion to get started.
            </p>
          </div>
        ) : (
          (messages ?? []).map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary",
                )}
              >
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary",
                )}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4">
        <ChatInput conversationId={conversation?.id ?? ""} />
      </div>
    </div>
  );
}
