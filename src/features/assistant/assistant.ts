import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { chat } from "@/lib/ai";
import { getOrCreateDefaultProject } from "@/features/social/accounts";
import { semanticSearch } from "@/features/search/semantic";
import { getCompetitorIntelligence } from "@/features/competitors/queries";
import { getAnalyticsData } from "@/features/analytics/queries";
import { buildInsightFacts } from "@/features/analytics/insights";
import { recommendSchedule, nextOccurrence } from "@/features/posts/recommend";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";
import { classifyIntent, type AssistantIntent } from "./intent";

type DB = SupabaseClient<Database>;

/** Analyzed media the user hasn't attached to any post yet. */
async function unpublishedMedia(db: DB) {
  const [{ data: analyzed }, { data: posts }] = await Promise.all([
    db.from("media").select("id, file_name, kind, folder_label").eq("status", "analyzed").limit(100),
    db.from("posts").select("media_id").not("media_id", "is", null),
  ]);
  const used = new Set((posts ?? []).map((p) => p.media_id));
  return (analyzed ?? []).filter((m) => !used.has(m.id));
}

/**
 * Retrieve a compact, answer-shaped DATA block for the query's intent. Designed
 * so that even without the LLM, the block reads as a usable answer (the RAG
 * fallback). This is the "R" in the assistant's retrieval-augmented answers.
 */
async function retrieveContext(db: DB, intent: AssistantIntent, query: string): Promise<string> {
  switch (intent) {
    case "unpublished": {
      const media = await unpublishedMedia(db);
      if (media.length === 0) return "Every analyzed clip has already been used in a post.";
      const list = media.slice(0, 12).map((m) => `- ${m.file_name}${m.folder_label ? ` (${m.folder_label})` : ""}`);
      return `You have ${media.length} analyzed item(s) not yet posted:\n${list.join("\n")}`;
    }
    case "search": {
      const hits = await semanticSearch(query, 10);
      if (hits.length === 0) return "No media matched that search. Only analyzed media is searchable.";
      return `Top matches:\n${hits.map((h) => `- ${h.file_name} (${Math.round(h.similarity * 100)}% match)`).join("\n")}`;
    }
    case "gaps": {
      const intel = await getCompetitorIntelligence();
      if (intel.opportunities.length === 0) return "Add competitors to surface content gaps and opportunities.";
      return `Top content opportunities:\n${intel.opportunities
        .slice(0, 5)
        .map((o) => `- ${o.topic} [${o.type}]: ${o.rationale}`)
        .join("\n")}`;
    }
    case "best_times": {
      const rec = recommendSchedule({});
      const when = nextOccurrence(rec.dayOfWeek, rec.hourLocal);
      const media = await unpublishedMedia(db);
      const candidates = media.slice(0, 3).map((m) => `- ${m.file_name}`);
      return (
        `Best posting window: ${rec.dayLabel} ${rec.timeLabel} (next: ${when.toDateString()}). ${rec.rationale}\n` +
        (candidates.length ? `Ready-to-post candidates:\n${candidates.join("\n")}` : "No unpublished candidates right now.")
      );
    }
    case "analytics": {
      const data = await getAnalyticsData(14);
      if (!data.hasData) return "No analytics captured yet. Publish a post and refresh metrics.";
      const facts = buildInsightFacts(data.totals, data.series, data.best[0]
        ? { caption: data.best[0].caption || "(no caption)", platform: data.best[0].platform, engagement: data.best[0].engagement }
        : undefined);
      return [facts.headline, ...facts.facts].join(" ");
    }
    default: {
      const [{ count: mediaCount }, { count: draftCount }, { count: acctCount }] = await Promise.all([
        db.from("media").select("id", { count: "exact", head: true }).eq("status", "analyzed"),
        db.from("posts").select("id", { count: "exact", head: true }).eq("status", "draft"),
        db.from("social_accounts").select("id", { count: "exact", head: true }).eq("status", "connected"),
      ]);
      return `Account snapshot: ${mediaCount ?? 0} analyzed media, ${draftCount ?? 0} drafts, ${acctCount ?? 0} connected accounts.`;
    }
  }
}

export interface AssistantReply {
  conversationId: string;
  answer: string;
}

/**
 * Answer a question grounded in the user's own data (RAG), and persist the
 * exchange as conversation memory. The LLM only phrases the retrieved DATA; if
 * it's unavailable, the retrieved block is returned directly.
 */
export async function answerQuestion(
  db: DB,
  ownerId: string,
  params: { conversationId?: string; message: string },
): Promise<AssistantReply> {
  const message = params.message.trim();
  const intent = classifyIntent(message);
  const context = await retrieveContext(db, intent, message);

  let answer: string;
  try {
    const text = await chat(
      [
        {
          role: "system",
          content:
            "You are the assistant inside a social media management app. Answer the user's " +
            "question using ONLY the DATA provided. Be concise, specific, and actionable. If the " +
            "DATA says there is nothing, say so plainly. Never invent posts, media, or numbers.",
        },
        { role: "user", content: `DATA:\n${context}\n\nQUESTION: ${message}` },
      ],
      { temperature: 0.3 },
    );
    answer = text.trim() || context;
  } catch (err) {
    logger.warn("assistant LLM unavailable; returning retrieved context", { message: (err as Error).message });
    answer = context;
  }

  // Persist conversation + messages (memory).
  let conversationId = params.conversationId;
  if (!conversationId) {
    const projectId = await getOrCreateDefaultProject(db, ownerId);
    const { data: conv, error } = await db
      .from("ai_conversations")
      .insert({ owner_id: ownerId, project_id: projectId, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (error || !conv) throw new Error(`Failed to start conversation: ${error?.message}`);
    conversationId = conv.id;
  } else {
    await db.from("ai_conversations").update({ title: message.slice(0, 60) }).eq("id", conversationId);
  }

  await db.from("ai_messages").insert([
    { conversation_id: conversationId, owner_id: ownerId, role: "user", content: message },
    { conversation_id: conversationId, owner_id: ownerId, role: "assistant", content: answer },
  ]);

  return { conversationId, answer };
}
