/**
 * Provider-agnostic AI contracts.
 *
 * Application code depends ONLY on these types and the `AIProvider` interface —
 * never on a concrete provider. Adding a provider means implementing this
 * interface and registering it; no call sites change.
 */

export type AICapability = "text" | "vision" | "embedding" | "transcription";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TextRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Optional JSON schema hint; providers that support structured output use it. */
  json?: boolean;
}

export interface TextResult {
  text: string;
  model: string;
  provider: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface VisionRequest {
  prompt: string;
  /** Base64-encoded images (no data: prefix). */
  images: string[];
  model?: string;
  temperature?: number;
}

export interface VisionResult {
  text: string;
  model: string;
  provider: string;
}

export interface EmbeddingRequest {
  input: string[];
  model?: string;
}

export interface AudioRequest {
  /** Raw audio bytes. */
  audio: Uint8Array;
  mimeType: string;
  model?: string;
  language?: string;
}

export interface Transcript {
  text: string;
  segments?: { start: number; end: number; text: string }[];
  model: string;
  provider: string;
}

export interface SummarizeRequest {
  text: string;
  instructions?: string;
  model?: string;
}

export interface Summary {
  summary: string;
  model: string;
  provider: string;
}

export interface VideoRequest {
  /** Base64 keyframes sampled from the video, in order. */
  frames: string[];
  transcript?: string;
  prompt: string;
  model?: string;
}

export interface VideoAnalysis {
  text: string;
  model: string;
  provider: string;
}

/**
 * The single interface every provider implements. A provider may throw
 * `AICapabilityUnsupportedError` for capabilities it does not offer; the
 * registry routes each capability to a provider that supports it.
 */
export interface AIProvider {
  readonly name: string;
  generateText(input: TextRequest): Promise<TextResult>;
  generateVision(input: VisionRequest): Promise<VisionResult>;
  generateEmbeddings(input: EmbeddingRequest): Promise<number[][]>;
  transcribeAudio(input: AudioRequest): Promise<Transcript>;
  summarize(input: SummarizeRequest): Promise<Summary>;
  analyzeVideo(input: VideoRequest): Promise<VideoAnalysis>;
}

export class AICapabilityUnsupportedError extends Error {
  constructor(provider: string, capability: string) {
    super(`Provider "${provider}" does not support capability "${capability}".`);
    this.name = "AICapabilityUnsupportedError";
  }
}

export class AIProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    /** Whether retrying could plausibly succeed (5xx/timeout/429 = true; 4xx = false). */
    public readonly retryable: boolean = true,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
