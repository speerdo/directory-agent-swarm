import Fuse from 'fuse.js';
import { getDb, createLogger } from '@agent-swarm/core';

const logger = createLogger('deduplicator');

export interface DedupeResult {
  isDuplicate: boolean;
  existingBusinessId?: string;
  similarity: number;
}

interface CacheEntry {
  businesses: { id: string; name: string; city_id: number }[];
  fuse: Fuse<{ id: string; name: string; city_id: number }> | null;
  lastRefresh: number;
}

const CACHE_TTL = 5 * 60 * 1000;
const cacheMap = new Map<string, CacheEntry>();

function getCacheKey(nicheId: string, cityId: number): string {
  return `${nicheId}:${cityId}`;
}

function getFuseInstance(entry: CacheEntry): Fuse<{ id: string; name: string; city_id: number }> {
  if (!entry.fuse) {
    entry.fuse = new Fuse(entry.businesses, {
      keys: ['name'],
      threshold: 0.3,
      includeScore: true,
      ignoreLocation: true,
    });
  }
  return entry.fuse;
}

async function refreshCache(nicheId: string, cityIds: number[]): Promise<CacheEntry> {
  const key = getCacheKey(nicheId, cityIds[0]);
  const existing = cacheMap.get(key);
  const now = Date.now();

  if (existing && now - existing.lastRefresh < CACHE_TTL && existing.businesses.length > 0) {
    return existing;
  }

  const db = getDb();

  const { data, error } = await db
    .from('businesses')
    .select('id, name, city_id')
    .eq('niche_id', nicheId)
    .in('city_id', cityIds);

  if (error) {
    logger.error({ nicheId, error }, 'Failed to refresh business cache');
    return existing ?? { businesses: [], fuse: null, lastRefresh: now };
  }

  const entry: CacheEntry = {
    businesses: data ?? [],
    fuse: null,
    lastRefresh: now,
  };
  cacheMap.set(key, entry);

  logger.info({ nicheId, cityId: cityIds[0], count: entry.businesses.length }, 'Business cache refreshed');
  return entry;
}

export async function checkDuplicate(
  name: string,
  nicheId: string,
  cityId: number
): Promise<DedupeResult> {
  const entry = await refreshCache(nicheId, [cityId]);

  const fuseInstance = getFuseInstance(entry);
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
  const entry = await refreshCache(nicheId, [cityId]);

  const results = new Map<string, DedupeResult>();
  const fuseInstance = getFuseInstance(entry);

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
