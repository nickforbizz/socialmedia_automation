import "server-only";

import { getServerEnv } from "@/lib/env";
import type { AIProviderName } from "@/lib/supabase/database.types";
import { OllamaProvider } from "@/lib/ai/providers/ollama";
import { UnconfiguredProvider } from "@/lib/ai/providers/unconfigured";
import type { AICapability, AIProvider } from "@/lib/ai/types";

/**
 * Provider registry + capability router.
 *
 * `getProvider(capability)` returns the configured provider for a capability,
 * selected purely from environment/config. This is the ONLY place that knows
 * about concrete providers. To add a provider: implement AIProvider, add it to
 * the factory map, done.
 */

type Factory = () => AIProvider;

const factories: Record<AIProviderName, Factory> = {
  ollama: () => new OllamaProvider(),
  openrouter: () => new UnconfiguredProvider("openrouter"),
  openai: () => new UnconfiguredProvider("openai"),
  anthropic: () => new UnconfiguredProvider("anthropic"),
  gemini: () => new UnconfiguredProvider("gemini"),
};

const instances = new Map<AIProviderName, AIProvider>();

function instantiate(name: AIProviderName): AIProvider {
  let existing = instances.get(name);
  if (!existing) {
    existing = factories[name]();
    instances.set(name, existing);
  }
  return existing;
}

const capabilityEnvKey: Record<AICapability, keyof ReturnType<typeof getServerEnv>> = {
  text: "AI_TEXT_PROVIDER",
  vision: "AI_VISION_PROVIDER",
  embedding: "AI_EMBEDDING_PROVIDER",
  transcription: "AI_TRANSCRIPTION_PROVIDER",
};

/**
 * Resolve the provider for a capability. An explicit `override` (e.g. from a
 * user's saved settings) wins over the environment default.
 */
export function getProvider(capability: AICapability, override?: AIProviderName): AIProvider {
  const env = getServerEnv();
  const name = override ?? (env[capabilityEnvKey[capability]] as AIProviderName);
  return instantiate(name);
}

/** Test/DI hook: force a provider instance for a name. */
export function registerProviderInstance(name: AIProviderName, provider: AIProvider): void {
  instances.set(name, provider);
}
