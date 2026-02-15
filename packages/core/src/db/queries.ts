import { getSupabaseAdmin } from './client.js';
import type {
  City,
  Niche,
  Business,
  PipelineJob,
  ApprovalQueueItem,
  Content,
  AIUsage,
  InsertBusiness,
  UpdateBusiness,
  InsertNiche,
  InsertPipelineJob,
  InsertApprovalQueue,
  InsertContent,
} from './schema.js';
import {
  CitySchema,
  NicheSchema,
  BusinessSchema,
  PipelineJobSchema,
  ApprovalQueueSchema,
  ContentSchema,
  AIUsageSchema,
} from './schema.js';

// Cities
export async function getAllCities(): Promise<City[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('cities')
    .select('*')
    .order('name');

  if (error) throw error;
  return CitySchema.array().parse(data ?? []);
}

export async function getCityById(id: number): Promise<City | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('cities')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return CitySchema.parse(data);
}

export async function getCitiesByState(stateCode: string): Promise<City[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('cities')
    .select('*')
    .eq('state_code', stateCode.toUpperCase())
    .order('name');

  if (error) throw error;
  return CitySchema.array().parse(data ?? []);
}

// Niches
export async function getAllNiches(): Promise<Niche[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('niches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return NicheSchema.array().parse(data ?? []);
}

export async function getNicheById(id: string): Promise<Niche | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('niches')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return NicheSchema.parse(data);
}

export async function getNichesByStatus(status: Niche['status']): Promise<Niche[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('niches')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return NicheSchema.array().parse(data ?? []);
}

export async function createNiche(niche: InsertNiche): Promise<Niche> {
  const { data, error } = await getSupabaseAdmin()
    .from('niches')
    .insert(niche)
    .select()
    .single();

  if (error) throw error;
  return NicheSchema.parse(data);
}

export async function updateNiche(id: string, updates: Partial<Niche>): Promise<Niche> {
  const { data, error } = await getSupabaseAdmin()
    .from('niches')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return NicheSchema.parse(data);
}

// Businesses
export async function getBusinessesByNiche(nicheId: string): Promise<Business[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('businesses')
    .select('*')
    .eq('niche_id', nicheId)
    .order('name');

  if (error) throw error;
  return BusinessSchema.array().parse(data ?? []);
}

export async function getBusinessesByNicheAndCity(nicheId: string, cityId: number): Promise<Business[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('businesses')
    .select('*')
    .eq('niche_id', nicheId)
    .eq('city_id', cityId)
    .order('name');

  if (error) throw error;
  return BusinessSchema.array().parse(data ?? []);
}

export async function getBusinessesByStatus(nicheId: string, status: Business['status']): Promise<Business[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('businesses')
    .select('*')
    .eq('niche_id', nicheId)
    .eq('status', status)
    .order('name');

  if (error) throw error;
  return BusinessSchema.array().parse(data ?? []);
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('businesses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return BusinessSchema.parse(data);
}

export async function getBusinessByPlaceId(placeId: string): Promise<Business | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('businesses')
    .select('*')
    .eq('google_place_id', placeId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return BusinessSchema.parse(data);
}

export async function createBusiness(business: InsertBusiness): Promise<Business> {
  const { data, error } = await getSupabaseAdmin()
    .from('businesses')
    .insert(business)
    .select()
    .single();

  if (error) throw error;
  return BusinessSchema.parse(data);
}

export async function createBusinesses(businesses: InsertBusiness[]): Promise<Business[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('businesses')
    .insert(businesses)
    .select();

  if (error) throw error;
  return BusinessSchema.array().parse(data ?? []);
}

export async function updateBusiness(id: string, updates: UpdateBusiness): Promise<Business> {
  const { data, error } = await getSupabaseAdmin()
    .from('businesses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return BusinessSchema.parse(data);
}

export async function countBusinessesByNiche(nicheId: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from('businesses')
    .select('*', { count: 'exact', head: true })
    .eq('niche_id', nicheId);

  if (error) throw error;
  return count ?? 0;
}

export async function countBusinessesByNicheAndStatus(
  nicheId: string,
  status: Business['status']
): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from('businesses')
    .select('*', { count: 'exact', head: true })
    .eq('niche_id', nicheId)
    .eq('status', status);

  if (error) throw error;
  return count ?? 0;
}

// Pipeline Jobs
export async function getPipelineJobsByNiche(nicheId: string): Promise<PipelineJob[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('pipeline_jobs')
    .select('*')
    .eq('niche_id', nicheId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return PipelineJobSchema.array().parse(data ?? []);
}

export async function getPipelineJobsByStatus(status: PipelineJob['status']): Promise<PipelineJob[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('pipeline_jobs')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return PipelineJobSchema.array().parse(data ?? []);
}

export async function createPipelineJob(job: InsertPipelineJob): Promise<PipelineJob> {
  const { data, error } = await getSupabaseAdmin()
    .from('pipeline_jobs')
    .insert(job)
    .select()
    .single();

  if (error) throw error;
  return PipelineJobSchema.parse(data);
}

export async function updatePipelineJob(id: string, updates: Partial<PipelineJob>): Promise<PipelineJob> {
  const { data, error } = await getSupabaseAdmin()
    .from('pipeline_jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return PipelineJobSchema.parse(data);
}

// Approval Queue
export async function getPendingApprovals(): Promise<ApprovalQueueItem[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('approval_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return ApprovalQueueSchema.array().parse(data ?? []);
}

export async function getApprovalById(id: string): Promise<ApprovalQueueItem | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('approval_queue')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return ApprovalQueueSchema.parse(data);
}

export async function createApprovalQueueItem(item: InsertApprovalQueue): Promise<ApprovalQueueItem> {
  const { data, error } = await getSupabaseAdmin()
    .from('approval_queue')
    .insert(item)
    .select()
    .single();

  if (error) throw error;
  return ApprovalQueueSchema.parse(data);
}

export async function updateApprovalQueueItem(
  id: string,
  updates: { status: ApprovalQueueItem['status']; reviewed_at?: string }
): Promise<ApprovalQueueItem> {
  const { data, error } = await getSupabaseAdmin()
    .from('approval_queue')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return ApprovalQueueSchema.parse(data);
}

// Content
export async function getContentByNiche(nicheId: string): Promise<Content[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('content')
    .select('*')
    .eq('niche_id', nicheId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ContentSchema.array().parse(data ?? []);
}

export async function getContentByNicheAndType(
  nicheId: string,
  contentType: Content['content_type']
): Promise<Content[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('content')
    .select('*')
    .eq('niche_id', nicheId)
    .eq('content_type', contentType)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ContentSchema.array().parse(data ?? []);
}

export async function getContentBySlug(slug: string): Promise<Content | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('content')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return ContentSchema.parse(data);
}

export async function createContent(content: InsertContent): Promise<Content> {
  const { data, error } = await getSupabaseAdmin()
    .from('content')
    .insert(content)
    .select()
    .single();

  if (error) throw error;
  return ContentSchema.parse(data);
}

export async function updateContent(id: string, updates: Partial<Content>): Promise<Content> {
  const { data, error } = await getSupabaseAdmin()
    .from('content')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return ContentSchema.parse(data);
}

// AI Usage
export async function recordAIUsage(usage: Omit<AIUsage, 'id' | 'created_at'>): Promise<AIUsage> {
  const { data, error } = await getSupabaseAdmin()
    .from('ai_usage')
    .insert(usage)
    .select()
    .single();

  if (error) throw error;
  return AIUsageSchema.parse(data);
}

export async function getAIUsageByNiche(nicheId: string): Promise<AIUsage[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('ai_usage')
    .select('*')
    .eq('niche_id', nicheId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return AIUsageSchema.array().parse(data ?? []);
}

export async function getTotalCostByNiche(nicheId: string): Promise<number> {
  const { data, error } = await getSupabaseAdmin()
    .from('ai_usage')
    .select('cost_usd')
    .eq('niche_id', nicheId);

  if (error) throw error;
  return (data ?? []).reduce((sum, r: { cost_usd: number | null }) => sum + (r.cost_usd ?? 0), 0);
}

export async function getTotalCostByModel(model: string): Promise<number> {
  const { data, error } = await getSupabaseAdmin()
    .from('ai_usage')
    .select('cost_usd')
    .eq('model', model);

  if (error) throw error;
  return (data ?? []).reduce((sum, r: { cost_usd: number | null }) => sum + (r.cost_usd ?? 0), 0);
}
