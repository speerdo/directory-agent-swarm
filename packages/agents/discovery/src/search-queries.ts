import { getDb, createLogger } from '@agent-swarm/core';

const logger = createLogger('search-queries');

export interface SearchQuery {
  query: string;
  type: 'primary' | 'secondary' | 'local';
}

// Generate search queries for a niche in a specific city
export async function generateSearchQueries(
  nicheId: string,
  cityId: number
): Promise<SearchQuery[]> {
  const db = getDb();

  // Get niche config
  const { data: niche, error: nicheError } = await db
    .from('niches')
    .select('config, display_name')
    .eq('id', nicheId)
    .single();

  if (nicheError || !niche) {
    logger.error({ nicheId, error: nicheError }, 'Failed to get niche config');
    throw new Error(`Niche not found: ${nicheId}`);
  }

  // Get city info
  const { data: city, error: cityError } = await db
    .from('cities')
    .select('name, state_code')
    .eq('id', cityId)
    .single();

  if (cityError || !city) {
    logger.error({ cityId, error: cityError }, 'Failed to get city info');
    throw new Error(`City not found: ${cityId}`);
  }

  const cityName = city.name;
  const stateCode = city.state_code;
  const nicheName = niche.display_name;

  const queries: SearchQuery[] = [];

  // Get base queries from niche config
  const configQueries = (niche.config as { search_queries?: string[] })?.search_queries ?? [];

  // Primary queries: direct service search
  for (const baseQuery of configQueries.slice(0, 3)) {
    queries.push({
      query: baseQuery.replace('{city}', `${cityName}, ${stateCode}`),
      type: 'primary',
    });
  }

  // Secondary queries: variations
  const secondaryQueries = [
    `best ${nicheName.toLowerCase()} ${cityName}`,
    `${nicheName.toLowerCase()} near me ${stateCode}`,
    `top rated ${nicheName.toLowerCase()} ${cityName}`,
  ];
  for (const q of secondaryQueries) {
    queries.push({ query: q, type: 'secondary' });
  }

  // Local queries
  queries.push({
    query: `${nicheName.toLowerCase()} ${cityName}, ${stateCode}`,
    type: 'local',
  });

  logger.info({ nicheId, cityId, queryCount: queries.length }, 'Generated search queries');

  return queries;
}

// Generate queries for multiple cities (batch)
export async function generateQueriesForCities(
  nicheId: string,
  cityIds: number[]
): Promise<Map<number, SearchQuery[]>> {
  const results = new Map<number, SearchQuery[]>();

  for (const cityId of cityIds) {
    try {
      const queries = await generateSearchQueries(nicheId, cityId);
      results.set(cityId, queries);
    } catch (error) {
      logger.error({ nicheId, cityId, error }, 'Failed to generate queries for city');
      results.set(cityId, []);
    }
  }

  return results;
}
