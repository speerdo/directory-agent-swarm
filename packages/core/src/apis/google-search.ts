import { createLogger } from '../utils/logger.js';
import { rateLimiter } from '../utils/rate-limiter.js';

const logger = createLogger('google-search');

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface SearchResponse {
  items: SearchResult[];
  searchInformation?: {
    totalResults: number;
  };
}

// Google Custom Search API
export async function searchGoogle(query: string): Promise<SearchResult[]> {
  await rateLimiter.waitForLimit('google-cse');

  const cx = process.env.GOOGLE_CSE_ID;
  const apiKey = process.env.GOOGLE_CSE_API_KEY;

  if (!cx || !apiKey) {
    throw new Error('GOOGLE_CSE_ID and GOOGLE_CSE_API_KEY are required');
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '10'); // Max 10 results per request

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.text();
    logger.error({ query, status: response.status, error }, 'Google CSE search failed');
    throw new Error(`Google CSE error: ${response.status} ${error}`);
  }

  const data = (await response.json()) as SearchResponse;

  return data.items ?? [];
}

// Batch search for multiple queries
export async function batchSearch(queries: string[]): Promise<Map<string, SearchResult[]>> {
  const results = new Map<string, SearchResult[]>();

  for (const query of queries) {
    try {
      const searchResults = await searchGoogle(query);
      results.set(query, searchResults);
    } catch (error) {
      logger.error({ query, error }, 'Search failed for query');
      results.set(query, []);
    }
  }

  return results;
}

// Get remaining CSE quota
export function getRemainingQuota(): number {
  return rateLimiter.getRemaining('google-cse');
}

// Get CSE quota reset time
export function getQuotaResetTime(): number {
  return rateLimiter.getResetTime('google-cse');
}
