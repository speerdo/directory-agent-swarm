import { createLogger } from '../utils/logger.js';
import { rateLimiter } from '../utils/rate-limiter.js';

const logger = createLogger('serp-api');

interface SerpSearchResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
}

interface SerpApiResponse {
  organic_results?: SerpSearchResult[];
  search_information?: {
    total_results?: number;
  };
  error?: string;
}

// SerpAPI wrapper - fallback when Google CSE quota exceeded
export async function searchSerpAPI(query: string): Promise<SerpSearchResult[]> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    throw new Error('SERPAPI_KEY is not configured');
  }

  await rateLimiter.waitForLimit('serp-api');

  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '10');
  url.searchParams.set('engine', 'google');

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.text();
    logger.error({ query, status: response.status, error }, 'SerpAPI search failed');
    throw new Error(`SerpAPI error: ${response.status} ${error}`);
  }

  const data = (await response.json()) as SerpApiResponse;

  if (data.error) {
    logger.error({ query, error: data.error }, 'SerpAPI returned error');
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  return data.organic_results ?? [];
}

// Batch search for multiple queries
export async function batchSearchSerpAPI(
  queries: string[]
): Promise<Map<string, SerpSearchResult[]>> {
  const results = new Map<string, SerpSearchResult[]>();

  for (const query of queries) {
    try {
      const searchResults = await searchSerpAPI(query);
      results.set(query, searchResults);
    } catch (error) {
      logger.error({ query, error }, 'SerpAPI search failed for query');
      results.set(query, []);
    }
  }

  return results;
}

// Get remaining SerpAPI credits
export async function getSerpAPICredits(): Promise<number | null> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const url = new URL('https://serpapi.com/account');
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { total_credits?: number };
    return data.total_credits ?? null;
  } catch {
    return null;
  }
}
