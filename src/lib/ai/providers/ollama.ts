import { getServerEnv } from "@/lib/env";
import { withRetry } from "@/lib/ai/retry";
import { RateLimiter } from "@/lib/ai/ratelimit";
import {
  AICapabilityUnsupportedError,
  AIProviderError,
  type AIProvider,
  type AudioRequest,
  type EmbeddingRequest,
  type SummarizeRequest,
  type Summary,
  type TextRequest,
  type TextResult,
  type Transcript,
  type VideoAnalysis,
  type VideoRequest,
  type VisionRequest,
  type VisionResult,
} from "@/lib/ai/types";

/**
 * Ollama provider — the default local backend.
 * Uses the native /api/chat and /api/embeddings endpoints.
 * Audio transcription is not offered by Ollama; the registry routes
 * transcription elsewhere (Phase 2 wires a Whisper-capable provider).
 */
export class OllamaProvider implements AIProvider {
  readonly name = "ollama";
  private readonly limiter = new RateLimiter(8, 4);

  private get env() {
    return getServerEnv();
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    await this.limiter.acquire();
    return withRetry(
      async () => {
        const res = await fetch(`${this.env.OLLAMA_BASE_URL}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => res.statusText);
          // 4xx (e.g. 404 model-not-found, 400 bad request) won't fix on retry;
          // only 5xx and 429 are worth retrying.
          const retryable = res.status >= 500 || res.status === 429;
          throw new AIProviderError(
            "ollama",
            `Ollama ${path} failed (${res.status}): ${detail}`,
            retryable,
            res.status,
          );
        }
        return (await res.json()) as T;
      },
      { label: `ollama${path}` },
    );
  }

  async generateText(input: TextRequest): Promise<TextResult> {
    const model = input.model ?? this.env.OLLAMA_TEXT_MODEL;
    const data = await this.post<{
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    }>("/api/chat", {
      model,
      messages: input.messages,
      stream: false,
      format: input.json ? "json" : undefined,
      options: {
        temperature: input.temperature ?? 0.7,
        ...(input.maxTokens ? { num_predict: input.maxTokens } : {}),
      },
    });
    return {
      text: data.message?.content ?? "",
      model,
      provider: this.name,
      usage: { promptTokens: data.prompt_eval_count, completionTokens: data.eval_count },
    };
  }

  async generateVision(input: VisionRequest): Promise<VisionResult> {
    const model = input.model ?? this.env.OLLAMA_VISION_MODEL;
    const data = await this.post<{ message?: { content?: string } }>("/api/chat", {
      model,
      messages: [{ role: "user", content: input.prompt, images: input.images }],
      stream: false,
      options: { temperature: input.temperature ?? 0.4 },
    });
    return { text: data.message?.content ?? "", model, provider: this.name };
  }

  async generateEmbeddings(input: EmbeddingRequest): Promise<number[][]> {
    const model = input.model ?? this.env.OLLAMA_EMBEDDING_MODEL;
    const data = await this.post<{ embeddings: number[][] }>("/api/embed", {
      model,
      input: input.input,
    });
    return data.embeddings;
  }

  async transcribeAudio(_input: AudioRequest): Promise<Transcript> {
    throw new AICapabilityUnsupportedError(this.name, "transcription");
  }

  async summarize(input: SummarizeRequest): Promise<Summary> {
    const result = await this.generateText({
      model: input.model,
      messages: [
        {
          role: "system",
          content:
            input.instructions ??
            "Summarize the following content concisely, preserving key facts and intent.",
        },
        { role: "user", content: input.text },
      ],
      temperature: 0.3,
    });
    return { summary: result.text, model: result.model, provider: this.name };
  }

  async analyzeVideo(input: VideoRequest): Promise<VideoAnalysis> {
    const prompt = input.transcript
      ? `${input.prompt}\n\nTranscript:\n${input.transcript}`
      : input.prompt;
    const result = await this.generateVision({
      model: input.model,
      prompt,
      images: input.frames,
    });
    return { text: result.text, model: result.model, provider: this.name };
  }
}
