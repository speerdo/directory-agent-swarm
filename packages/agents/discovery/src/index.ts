import { Worker, Queue } from 'bullmq';
import { getRedisConnection, getSupabaseAdmin, createLogger, searchGoogle, batchSearch } from '@agent-swarm/core';

import { generateSearchQueries, type SearchQuery } from './search-queries.js';
import { extractBusinessNames, parseAllSearchResults } from './result-parser.js';
import { filterDuplicates } from './deduplicator.js';

const logger = createLogger('discovery');

// Job data types
export interface DiscoveryJob {
  nicheId: string;
  cityId: number;
}

export interface DiscoveryResult {
  nicheId: string;
  cityId: number;
  businessesFound: number;
  businessesAdded: number;
}

// Main discovery function
export async function discoverBusinesses(
  nicheId: string,
  cityId: number
): Promise<DiscoveryResult> {
  logger.info({ nicheId, cityId }, 'Starting business discovery');

  // Step 1: Generate search queries
  const queries = await generateSearchQueries(nicheId, cityId);
  logger.info({ nicheId, cityId, queryCount: queries.length }, 'Generated search queries');

  // Step 2: Execute searches
  const searchQueryStrings = queries.map(q => q.query);
  const queryResults = await batchSearch(searchQueryStrings);
  logger.info({ nicheId, cityId }, 'Search queries executed');

  // Step 3: Get niche name for parsing
  const supabase = getSupabaseAdmin();
  const { data: niche } = await supabase
    .from('niches')
    .select('display_name')
    .eq('id', nicheId)
    .single();

  const nicheName = niche?.display_name ?? 'business';

  // Step 4: Extract business names from results
  const businesses = await parseAllSearchResults(queryResults, nicheName);
  logger.info({ nicheId, cityId, extractedCount: businesses.length }, 'Extracted businesses from search results');

  // Step 5: Filter duplicates
  const uniqueBusinesses = await filterDuplicates(businesses, nicheId, cityId);
  logger.info({ nicheId, cityId, uniqueCount: uniqueBusinesses.length }, 'Deduplication complete');

  // Step 6: Insert into database
  const { data: city } = await supabase
    .from('cities')
    .select('id')
    .eq('id', cityId)
    .single();

  if (uniqueBusinesses.length > 0 && city) {
    const businessRecords = uniqueBusinesses.map(b => ({
      niche_id: nicheId,
      city_id: cityId,
      name: b.name,
      source: 'google_search',
      status: 'discovered' as const,
      confidence: b.confidence,
    }));

    const { error: insertError } = await supabase
      .from('businesses')
      .insert(businessRecords);

    if (insertError) {
      logger.error({ nicheId, cityId, error: insertError }, 'Failed to insert businesses');
    } else {
      logger.info({ nicheId, cityId, count: businessRecords.length }, 'Inserted businesses into database');
    }
  }

  return {
    nicheId,
    cityId,
    businessesFound: businesses.length,
    businessesAdded: uniqueBusinesses.length,
  };
}

// BullMQ worker
const connection = getRedisConnection();

const worker = new Worker<DiscoveryJob>(
  'discovery',
  async (job) => {
    const { nicheId, cityId } = job.data;

    logger.info({ jobId: job.id, nicheId, cityId }, 'Processing discovery job');

    try {
      const result = await discoverBusinesses(nicheId, cityId);
      logger.info(
        { jobId: job.id, nicheId, cityId, found: result.businessesFound, added: result.businessesAdded },
        'Discovery job completed'
      );
      return result;
    } catch (error) {
      logger.error({ jobId: job.id, nicheId, cityId, error }, 'Discovery job failed');
      throw error;
    }
  },
  {
    // @ts-expect-error - BullMQ connection type mismatch
    connection,
    concurrency: 5,
    limiter: {
      max: 100,
      duration: 24 * 60 * 60 * 1000,
    },
  }
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed');
});

worker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error }, 'Job failed');
});

worker.on('error', (error) => {
  logger.error({ error }, 'Worker error');
});

// Queue for scheduling jobs
export const discoveryQueue = new Queue<DiscoveryJob>('discovery', {
  // @ts-expect-error - BullMQ connection type mismatch
  connection,
});

// Helper to enqueue discovery jobs
export async function enqueueDiscoveryJob(nicheId: string, cityId: number): Promise<void> {
  // @ts-expect-error - BullMQ type mismatch
  await discoveryQueue.add('discover', {
    nicheId,
    cityId,
  }, {
    removeOnComplete: true,
    removeOnFail: 100,
  });

  logger.info({ nicheId, cityId }, 'Enqueued discovery job');
}

// Helper to enqueue batch of cities
export async function enqueueDiscoveryForCities(
  nicheId: string,
  cityIds: number[]
): Promise<void> {
  const jobs = cityIds.map(cityId => ({
    name: 'discover',
    data: { nicheId, cityId },
    opts: {
      removeOnComplete: true,
      removeOnFail: 100,
    },
  }));

  // @ts-expect-error - BullMQ type mismatch
  await discoveryQueue.addBulk(jobs);

  logger.info({ nicheId, cityCount: cityIds.length }, 'Enqueued batch discovery jobs');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker');
  await worker.close();
  process.exit(0);
});

logger.info('Discovery worker started');
