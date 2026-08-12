export interface EmbeddingTextContext {
  fileName: string;
  folderLabel?: string | null;
  description?: string | null;
  keywords?: string[];
  category?: string | null;
  mood?: string | null;
  transcript?: string | null;
}

/**
 * Compose the single text blob that represents a media item in embedding space.
 * Ordering matters less than coverage: we want folder/topic, visual description,
 * keywords, category, mood and (when available) transcript all represented so
 * natural-language queries like "sunset drone footage" match. Pure + testable.
 */
export function buildEmbeddingText(ctx: EmbeddingTextContext): string {
  const parts: string[] = [];
  const base = ctx.fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ");
  parts.push(base);
  if (ctx.folderLabel) parts.push(ctx.folderLabel);
  if (ctx.category) parts.push(ctx.category);
  if (ctx.mood) parts.push(ctx.mood);
  if (ctx.description) parts.push(ctx.description);
  if (ctx.keywords?.length) parts.push(ctx.keywords.join(", "));
  if (ctx.transcript) parts.push(ctx.transcript.slice(0, 2000));
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(". ");
}
