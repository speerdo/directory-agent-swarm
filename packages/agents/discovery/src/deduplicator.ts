import Fuse from 'fuse.js';
import { getSupabaseAdmin, createLogger } from '@agent-swarm/core';

const logger = createLogger('deduplicator');

export interface DedupeResult {
  isDuplicate: boolean;
  existingBusinessId?: string;
  similarity: number;
}

let businessCache: { id: string; name: string; city_id: number }[] = [];
let lastCacheRefresh = 0;
const CACHE_TTL = 5 * 60 * 1000;

let fuse: Fuse<{ id: string; name: string; city_id: number }> | null = null;

function getFuseInstance() {
  if (!fuse) {
    fuse = new Fuse(businessCache, {
      keys: ['name'],
      threshold: 0.3,
      includeScore: true,
      ignoreLocation: true,
    });
  }
  return fuse;
}

async function refreshCache(nicheId: string, cityIds: number[]): Promise<void> {
  const now = Date.now();
  if (now - lastCacheRefresh < CACHE_TTL && businessCache.length > 0) {
    return;
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, city_id')
    .eq('niche_id', nicheId)
    .in('city_id', cityIds)
    .eq('status', 'discovered');

  if (error) {
    logger.error({ nicheId, error }, 'Failed to refresh business cache');
    return;
  }

  businessCache = data ?? [];
  lastCacheRefresh = now;
  fuse = null;

  logger.info({ count: businessCache.length }, 'Business cache refreshed');
}

export async function checkDuplicate(
  name: string,
  nicheId: string,
  cityId: number
): Promise<DedupeResult> {
  await refreshCache(nicheId, [cityId]);

  const fuseInstance = getFuseInstance();
  const results = fuseInstance.search(name);

  if (results.length > 0) {
    const bestMatch = results[0];
    const similarity = 1 - (bestMatch.score ?? 0);

    if (similarity > 0.85) {
      return {
        isDuplicate: true,
        existingBusinessId: bestMatch.item.id,
        similarity,
      };
    }
  }

  return {
    isDuplicate: false,
    similarity: 0,
  };
}

export async function checkDuplicates(
  businesses: { name: string }[],
  nicheId: string,
  cityId: number
): Promise<Map<string, DedupeResult>> {
  await refreshCache(nicheId, [cityId]);

  const results = new Map<string, DedupeResult>();
  const fuseInstance = getFuseInstance();

  for (const business of businesses) {
    const matches = fuseInstance.search(business.name);

    if (matches.length > 0) {
      const bestMatch = matches[0];
      const similarity = 1 - (bestMatch.score ?? 0);

      if (similarity > 0.85) {
        results.set(business.name, {
          isDuplicate: true,
          existingBusinessId: bestMatch.item.id,
          similarity,
        });
        continue;
      }
    }

    results.set(business.name, {
      isDuplicate: false,
      similarity: 0,
    });
  }

  return results;
}

export async function filterDuplicates(
  businesses: { name: string; sourceSnippet?: string; sourceUrl?: string; confidence: number }[],
  nicheId: string,
  cityId: number
): Promise<{ name: string; sourceSnippet?: string; sourceUrl?: string; confidence: number }[]> {
  const dedupeResults = await checkDuplicates(businesses, nicheId, cityId);

  const uniqueBusinesses: { name: string; sourceSnippet?: string; sourceUrl?: string; confidence: number }[] = [];

  for (const business of businesses) {
    const result = dedupeResults.get(business.name);

    if (!result?.isDuplicate) {
      uniqueBusinesses.push(business);
    } else {
      logger.debug({ name: business.name, similarity: result.similarity }, 'Skipped duplicate');
    }
  }

  logger.info({
    inputCount: businesses.length,
    outputCount: uniqueBusinesses.length,
    duplicatesRemoved: businesses.length - uniqueBusinesses.length,
  }, 'Deduplication complete');

  return uniqueBusinesses;
}
