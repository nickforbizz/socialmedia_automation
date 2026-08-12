import {
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
 * Placeholder for cloud providers (OpenRouter/OpenAI/Anthropic/Gemini).
 *
 * The registry and routing are complete NOW, so switching providers is a
 * config change. Each cloud provider is a Phase-2+ seam: replace this class
 * with a real implementation of `AIProvider`. It intentionally throws rather
 * than returning fake output — no placeholder logic.
 */
export class UnconfiguredProvider implements AIProvider {
  constructor(readonly name: string) {}

  private fail(): never {
    throw new AIProviderError(
      this.name,
      `Provider "${this.name}" is selected but not implemented yet. ` +
        `Implement it in src/lib/ai/providers/${this.name}.ts and register it in registry.ts.`,
    );
  }

  generateText(_input: TextRequest): Promise<TextResult> {
    this.fail();
  }
  generateVision(_input: VisionRequest): Promise<VisionResult> {
    this.fail();
  }
  generateEmbeddings(_input: EmbeddingRequest): Promise<number[][]> {
    this.fail();
  }
  transcribeAudio(_input: AudioRequest): Promise<Transcript> {
    this.fail();
  }
  summarize(_input: SummarizeRequest): Promise<Summary> {
    this.fail();
  }
  analyzeVideo(_input: VideoRequest): Promise<VideoAnalysis> {
    this.fail();
  }
}
