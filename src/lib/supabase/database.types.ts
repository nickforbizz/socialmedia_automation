/**
 * Database types.
 *
 * This is a hand-authored version kept in sync with supabase/migrations.
 * In a live project regenerate it with `npm run db:types`
 * (supabase gen types typescript). It is committed so the app type-checks
 * without a running database.
 *
 * NOTE: row shapes are declared as `type` aliases (not `interface`) on purpose.
 * The Supabase client's `GenericSchema` constraint requires each Row/Insert/
 * Update to be assignable to `Record<string, unknown>`; interfaces lack the
 * implicit index signature and would silently degrade every query to `never`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MediaKind = "video" | "image" | "audio";
export type MediaStatus = "ingesting" | "ready" | "analyzed" | "failed";
export type AIProviderName = "ollama" | "openrouter" | "openai" | "anthropic" | "gemini";
export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "youtube"
  | "tiktok"
  | "linkedin"
  | "x";
export type AccountStatus = "connected" | "expired" | "revoked" | "error";
export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";

type Timestamps = { created_at: string; updated_at: string };

type ProfilesRow = Timestamps & {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type ProjectsRow = Timestamps & {
  id: string;
  owner_id: string;
  name: string;
};

type BrandsRow = Timestamps & {
  id: string;
  project_id: string;
  owner_id: string;
  name: string;
  voice: string | null;
  default_hashtags: string[];
};

type SettingsRow = Timestamps & {
  user_id: string;
  text_provider: AIProviderName;
  vision_provider: AIProviderName;
  embedding_provider: AIProviderName;
  preferred_model: string | null;
  temperature: number;
  watch_folders: string[];
};

type MediaRow = Timestamps & {
  id: string;
  owner_id: string;
  project_id: string;
  kind: MediaKind;
  status: MediaStatus;
  source_path: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  content_hash: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
  captured_at: string | null;
  folder_label: string | null;
};

type MediaAnalysisRow = Timestamps & {
  id: string;
  media_id: string;
  owner_id: string;
  transcript: string | null;
  ocr_text: string | null;
  objects: Json;
  scenes: Json;
  category: string | null;
  tone: string | null;
  mood: string | null;
  keywords: string[];
  quality_score: number | null;
  viral_score: number | null;
  embedding: string | null;
};

type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Json;
  created_at: string;
};

type MediaIntelligenceRow = Timestamps & {
  id: string;
  media_id: string;
  owner_id: string;
  titles: string[];
  hooks: string[];
  captions: string[];
  descriptions: string[];
  hashtags: string[];
  ctas: string[];
  thumbnail_ideas: string[];
  best_cover_frame_sec: number | null;
  target_audience: string | null;
  recommended_platforms: string[];
  engagement_prediction: Json;
  provider: string | null;
  model: string | null;
  generated_at: string;
};

type PromptTemplateRow = Timestamps & {
  id: string;
  owner_id: string | null;
  key: string;
  version: number;
  template: string;
  description: string | null;
};

type SocialAccountRow = Timestamps & {
  id: string;
  owner_id: string;
  project_id: string;
  platform: SocialPlatform;
  external_account_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  access_token_cipher: string | null;
  refresh_token_cipher: string | null;
  token_expires_at: string | null;
  scopes: string[];
  status: AccountStatus;
  is_mock: boolean;
  last_checked_at: string | null;
};

type PostRow = Timestamps & {
  id: string;
  owner_id: string;
  project_id: string;
  social_account_id: string | null;
  media_id: string | null;
  platform: SocialPlatform;
  caption: string;
  hashtags: string[];
  link: string | null;
  status: PostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  external_post_id: string | null;
  external_url: string | null;
  error: string | null;
  retry_count: number;
};

type MetricsBase = {
  impressions: number;
  reach: number;
  views: number;
  watch_time_sec: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
};

type PostMetricsRow = MetricsBase & {
  id: string;
  post_id: string;
  owner_id: string;
  captured_at: string;
};

type AccountMetricsRow = {
  id: string;
  social_account_id: string;
  owner_id: string;
  captured_at: string;
  followers: number;
  following: number;
  posts_count: number;
};

type PostMetricsLatestRow = MetricsBase & {
  post_id: string;
  owner_id: string;
  captured_at: string;
};

type PendingConnectionRow = {
  id: string;
  owner_id: string;
  project_id: string;
  platform: SocialPlatform;
  options: Json;
  created_at: string;
};

type TableShape<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type ViewShape<Row> = { Row: Row; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<
        ProfilesRow,
        Partial<ProfilesRow> & Pick<ProfilesRow, "id">,
        Partial<ProfilesRow>
      >;
      projects: TableShape<
        ProjectsRow,
        Omit<ProjectsRow, "id" | keyof Timestamps> & { id?: string },
        Partial<ProjectsRow>
      >;
      brands: TableShape<
        BrandsRow,
        Omit<BrandsRow, "id" | keyof Timestamps | "default_hashtags"> & {
          id?: string;
          default_hashtags?: string[];
        },
        Partial<BrandsRow>
      >;
      settings: TableShape<
        SettingsRow,
        Omit<SettingsRow, keyof Timestamps> & Partial<SettingsRow>,
        Partial<SettingsRow>
      >;
      media: TableShape<
        MediaRow,
        Omit<MediaRow, "id" | keyof Timestamps | "status"> & {
          id?: string;
          status?: MediaStatus;
        },
        Partial<MediaRow>
      >;
      media_analysis: TableShape<
        MediaAnalysisRow,
        Omit<MediaAnalysisRow, "id" | keyof Timestamps> & { id?: string },
        Partial<MediaAnalysisRow>
      >;
      audit_log: TableShape<
        AuditLogRow,
        Omit<AuditLogRow, "id" | "created_at"> & { id?: string },
        Partial<AuditLogRow>
      >;
      media_intelligence: TableShape<
        MediaIntelligenceRow,
        Omit<MediaIntelligenceRow, "id" | keyof Timestamps | "generated_at"> & {
          id?: string;
          generated_at?: string;
        },
        Partial<MediaIntelligenceRow>
      >;
      prompt_templates: TableShape<
        PromptTemplateRow,
        Omit<PromptTemplateRow, "id" | keyof Timestamps | "version"> & {
          id?: string;
          version?: number;
        },
        Partial<PromptTemplateRow>
      >;
      social_accounts: TableShape<
        SocialAccountRow,
        Omit<SocialAccountRow, "id" | keyof Timestamps | "status" | "scopes" | "is_mock"> & {
          id?: string;
          status?: AccountStatus;
          scopes?: string[];
          is_mock?: boolean;
        },
        Partial<SocialAccountRow>
      >;
      posts: TableShape<
        PostRow,
        Omit<
          PostRow,
          "id" | keyof Timestamps | "status" | "hashtags" | "caption" | "retry_count"
        > & {
          id?: string;
          status?: PostStatus;
          hashtags?: string[];
          caption?: string;
          retry_count?: number;
        },
        Partial<PostRow>
      >;
      post_metrics: TableShape<
        PostMetricsRow,
        Omit<PostMetricsRow, "id" | "captured_at"> & { id?: string; captured_at?: string },
        Partial<PostMetricsRow>
      >;
      account_metrics: TableShape<
        AccountMetricsRow,
        Omit<AccountMetricsRow, "id" | "captured_at"> & { id?: string; captured_at?: string },
        Partial<AccountMetricsRow>
      >;
      pending_connections: TableShape<
        PendingConnectionRow,
        Omit<PendingConnectionRow, "id" | "created_at"> & { id?: string; created_at?: string },
        Partial<PendingConnectionRow>
      >;
    };
    Views: {
      post_metrics_latest: ViewShape<PostMetricsLatestRow>;
    };
    Functions: {
      match_media_analysis: {
        Args: { query_embedding: string; match_count?: number };
        Returns: { media_id: string; similarity: number }[];
      };
    };
    Enums: {
      media_kind: MediaKind;
      media_status: MediaStatus;
      ai_provider: AIProviderName;
      social_platform: SocialPlatform;
      account_status: AccountStatus;
      post_status: PostStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
