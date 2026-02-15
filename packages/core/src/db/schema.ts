import { z } from 'zod';

// City schema
export const CitySchema = z.object({
  id: z.number(),
  name: z.string(),
  state_code: z.string().length(2),
  state_name: z.string(),
  population: z.number().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

export type City = z.infer<typeof CitySchema>;

// Niche schema
export const NicheSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  domain: z.string().nullable(),
  status: z.enum(['researching', 'approved', 'building', 'live']),
  config: z.record(z.unknown()).default({}),
  opportunity_score: z.number().nullable(),
  created_at: z.string(),
});

export type Niche = z.infer<typeof NicheSchema>;

// Business schema
export const BusinessSchema = z.object({
  id: z.string().uuid(),
  niche_id: z.string(),
  city_id: z.number(),
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  google_place_id: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  status: z.enum(['discovered', 'verified', 'enriched', 'live', 'removed']),
  confidence: z.number().nullable(),
  description: z.string().nullable(),
  service_flags: z.record(z.boolean()).default({}),
  schema_json: z.record(z.unknown()).nullable(),
  source: z.string().nullable(),
  discovered_at: z.string(),
  verified_at: z.string().nullable(),
  enriched_at: z.string().nullable(),
});

export type Business = z.infer<typeof BusinessSchema>;

// Pipeline job schema
export const PipelineJobSchema = z.object({
  id: z.string().uuid(),
  niche_id: z.string(),
  agent: z.string(),
  city_id: z.number().nullable(),
  status: z.enum(['queued', 'running', 'done', 'failed', 'paused']),
  input: z.record(z.unknown()).default({}),
  output: z.record(z.unknown()).default({}),
  error: z.string().nullable(),
  attempts: z.number().default(0),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
});

export type PipelineJob = z.infer<typeof PipelineJobSchema>;

// Approval queue schema
export const ApprovalQueueSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  agent: z.string(),
  reason: z.string().nullable(),
  ai_recommendation: z.string().nullable(),
  confidence: z.number().nullable(),
  status: z.enum(['pending', 'approved', 'rejected']),
  reviewed_at: z.string().nullable(),
});

export type ApprovalQueueItem = z.infer<typeof ApprovalQueueSchema>;

// Content schema
export const ContentSchema = z.object({
  id: z.string().uuid(),
  niche_id: z.string(),
  city_id: z.number().nullable(),
  content_type: z.enum(['city_page', 'blog_post', 'meta_description']),
  title: z.string().nullable(),
  body: z.string().nullable(),
  meta_title: z.string().nullable(),
  meta_description: z.string().nullable(),
  slug: z.string().nullable(),
  status: z.enum(['draft', 'reviewed', 'published']),
  created_at: z.string(),
});

export type Content = z.infer<typeof ContentSchema>;

// AI usage schema
export const AIUsageSchema = z.object({
  id: z.number(),
  task_type: z.string(),
  model: z.string(),
  input_tokens: z.number().nullable(),
  output_tokens: z.number().nullable(),
  cost_usd: z.number().nullable(),
  latency_ms: z.number().nullable(),
  niche_id: z.string().nullable(),
  agent: z.string().nullable(),
  created_at: z.string(),
});

export type AIUsage = z.infer<typeof AIUsageSchema>;

// Input schemas (for validation)
export const InsertBusinessSchema = BusinessSchema.omit({
  id: true,
  discovered_at: true,
  verified_at: true,
  enriched_at: true,
}).extend({
  id: BusinessSchema.shape.id.optional(),
});

export type InsertBusiness = z.infer<typeof InsertBusinessSchema>;

export const UpdateBusinessSchema = BusinessSchema.partial().omit({
  id: true,
  niche_id: true,
  city_id: true,
  name: true,
  discovered_at: true,
});

export type UpdateBusiness = z.infer<typeof UpdateBusinessSchema>;

export const InsertNicheSchema = NicheSchema.omit({
  created_at: true,
}).extend({
  id: NicheSchema.shape.id.optional(),
});

export type InsertNiche = z.infer<typeof InsertNicheSchema>;

export const InsertPipelineJobSchema = PipelineJobSchema.omit({
  id: true,
  created_at: true,
}).extend({
  id: PipelineJobSchema.shape.id.optional(),
});

export type InsertPipelineJob = z.infer<typeof InsertPipelineJobSchema>;

export const InsertApprovalQueueSchema = ApprovalQueueSchema.omit({
  id: true,
  reviewed_at: true,
}).extend({
  id: ApprovalQueueSchema.shape.id.optional(),
});

export type InsertApprovalQueue = z.infer<typeof InsertApprovalQueueSchema>;

export const InsertContentSchema = ContentSchema.omit({
  id: true,
  created_at: true,
}).extend({
  id: ContentSchema.shape.id.optional(),
});

export type InsertContent = z.infer<typeof InsertContentSchema>;
