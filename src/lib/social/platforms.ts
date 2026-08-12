import type { SocialPlatform } from "@/lib/supabase/database.types";

export const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "youtube",
  "tiktok",
  "linkedin",
  "x",
] as const;

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X",
};

export function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}
