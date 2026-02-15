import { searchGoogle, type SearchResult } from '@agent-swarm/core';
import { createLogger } from '@agent-swarm/core';

const logger = createLogger('competitor-scan');

export interface CompetitorResult {
  name: string;
  url: string;
  description: string;
  estimatedTraffic: 'low' | 'medium' | 'high';
  quality: number; // 1-10
  coverage: number; // 1-10
  freshness: number; // 1-10
  mobileFriendly: boolean;
  hasSeo: boolean;
}

export interface CompetitorAnalysis {
  competitors: CompetitorResult[];
  overallGaps: string[];
  weaknesses: string[];
}

// Score a directory based on its search result appearance
function scoreDirectory(result: SearchResult): Partial<CompetitorResult> {
  const title = result.title.toLowerCase();
  const snippet = result.snippet.toLowerCase();

  // Check for indicators of quality
  const hasList = title.includes('list') || title.includes('directory');
  const hasMap = snippet.includes('map') || snippet.includes('near');
  const hasReviews = snippet.includes('review') || snippet.includes('rating');

  return {
    name: result.title,
    url: result.link,
    description: result.snippet,
    quality: hasList ? 7 : 5,
    coverage: hasMap ? 6 : 4,
    freshness: hasReviews ? 7 : 5,
    estimatedTraffic: hasMap ? 'high' : 'medium',
    mobileFriendly: true, // Most modern sites are
    hasSeo: true,
  };
}

// Find existing directories for a niche
export async function scanCompetitors(niche: string): Promise<CompetitorAnalysis> {
  const searchQueries = [
    `${niche} directory`,
    `${niche} list`,
    `best ${niche}`,
    `top ${niche} services`,
  ];

  const allResults: SearchResult[] = [];

  for (const query of searchQueries) {
    try {
      const results = await searchGoogle(query);
      allResults.push(...results);
    } catch (error) {
      logger.warn({ query, error }, 'Failed to search competitors');
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const uniqueResults = allResults.filter(r => {
    if (seen.has(r.link)) return false;
    seen.add(r.link);
    return true;
  });

  // Score each competitor
  const competitors: CompetitorResult[] = uniqueResults.slice(0, 10).map(result => {
    const scored = scoreDirectory(result);
    return scored as CompetitorResult;
  });

  // Identify gaps and weaknesses
  const weaknesses: string[] = [];
  const overallGaps: string[] = [];

  const avgQuality = competitors.reduce((sum, c) => sum + c.quality, 0) / competitors.length;
  const avgCoverage = competitors.reduce((sum, c) => sum + c.coverage, 0) / competitors.length;

  if (avgQuality < 6) {
    weaknesses.push('Low quality competitors - opportunity for better UX');
  }
  if (avgCoverage < 5) {
    weaknesses.push('Limited geographic coverage - can target underserved cities');
    overallGaps.push('National directory coverage');
  }
  if (competitors.length < 3) {
    overallGaps.push('Few established competitors');
    weaknesses.push('Market is underserved');
  }

  return {
    competitors,
    overallGaps,
    weaknesses,
  };
}

// Generate a grade for the niche based on competition
export function gradeCompetition(analysis: CompetitorAnalysis): {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
} {
  const competitorCount = analysis.competitors.length;

  if (competitorCount === 0) {
    return { grade: 'A', summary: 'No significant competitors found' };
  }

  const avgQuality = analysis.competitors.reduce((sum, c) => sum + c.quality, 0) / competitorCount;

  if (competitorCount < 3 && avgQuality < 6) {
    return { grade: 'A', summary: 'Weak competition, easy to dominate' };
  }
  if (competitorCount < 5 && avgQuality < 7) {
    return { grade: 'B', summary: 'Moderate competition with room for improvement' };
  }
  if (competitorCount < 8 && avgQuality < 8) {
    return { grade: 'C', summary: 'Established market but quality gaps exist' };
  }
  if (competitorCount < 10) {
    return { grade: 'D', summary: 'Competitive market, differentiation needed' };
  }

  return { grade: 'F', summary: 'Saturated market, very difficult to compete' };
}
