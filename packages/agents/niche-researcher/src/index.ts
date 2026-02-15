import { Worker } from 'bullmq';
import { getRedisConnection } from '@agent-swarm/core';
import { createLogger } from '@agent-swarm/core';
import { getSupabaseAdmin } from '@agent-swarm/core';

import { analyzeNicheTrends, expandNicheKeywords } from './search-strategy.js';
import { scanCompetitors } from './competitor-scan.js';
import { calculateOpportunityScore } from './opportunity-score.js';
import { generateReport, formatReportAsMarkdown, formatReportAsSummary } from './report-generator.js';

const logger = createLogger('niche-researcher');

// Job data types
export interface NicheResearchJob {
  nicheId: string;
  nicheName: string;
}

export interface NicheResearchResult {
  nicheId: string;
  opportunityScore: number;
  report: string;
  summary: string;
}

// Main research function
export async function researchNiche(nicheId: string, nicheName: string): Promise<NicheResearchResult> {
  logger.info({ nicheId, nicheName }, 'Starting niche research');

  // Step 1: Analyze trends
  const trendData = await analyzeNicheTrends(nicheName);
  logger.info({ nicheId, trendCount: trendData.length }, 'Trend analysis complete');

  // Step 2: Scan competitors
  const competitorAnalysis = await scanCompetitors(nicheName);
  logger.info({ nicheId, competitorCount: competitorAnalysis.competitors.length }, 'Competitor scan complete');

  // Step 3: Calculate opportunity score
  const opportunityScore = await calculateOpportunityScore(nicheName, competitorAnalysis, trendData);
  logger.info({ nicheId, score: opportunityScore.totalScore }, 'Opportunity score calculated');

  // Step 4: Generate report
  const report = generateReport(nicheName, opportunityScore, competitorAnalysis, trendData);
  const markdown = formatReportAsMarkdown(report);
  const summary = formatReportAsSummary(report);

  // Step 5: Save to database
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('niches').update({
    opportunity_score: opportunityScore.totalScore,
    config: {
      // Merge with existing config
    },
  }).eq('id', nicheId);

  if (error) {
    logger.error({ nicheId, error }, 'Failed to save opportunity score to database');
  } else {
    logger.info({ nicheId }, 'Saved opportunity score to database');
  }

  return {
    nicheId,
    opportunityScore: opportunityScore.totalScore,
    report: markdown,
    summary,
  };
}

// BullMQ worker
const connection = getRedisConnection();

const worker = new Worker<NicheResearchJob>(
  'niche-research',
  async (job) => {
    const { nicheId, nicheName } = job.data;

    logger.info({ jobId: job.id, nicheId, nicheName }, 'Processing niche research job');

    try {
      const result = await researchNiche(nicheId, nicheName);
      logger.info({ jobId: job.id, nicheId, score: result.opportunityScore }, 'Niche research completed');
      return result;
    } catch (error) {
      logger.error({ jobId: job.id, nicheId, error }, 'Niche research failed');
      throw error;
    }
  },
  {
    // @ts-expect-error - BullMQ connection type mismatch
    connection,
    concurrency: 2, // Process 2 niche research jobs at a time
    limiter: {
      max: 10,
      duration: 60 * 1000, // 10 per minute
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

logger.info('Niche researcher worker started');

// Export for CLI usage
export async function runNicheResearch(nicheName: string): Promise<NicheResearchResult> {
  const nicheId = nicheName.toLowerCase().replace(/\s+/g, '-');

  // Check if niche exists in DB
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('niches')
    .select('id')
    .eq('id', nicheId)
    .single();

  if (!existing) {
    // Create new niche entry
    await supabase.from('niches').insert({
      id: nicheId,
      display_name: nicheName,
      status: 'researching',
    });
  }

  return researchNiche(nicheId, nicheName);
}
