import { callAI, callAIWithPrompt, type TaskType } from '@agent-swarm/core';
import { searchGoogle } from '@agent-swarm/core';
import { createLogger } from '@agent-swarm/core';

const logger = createLogger('niche-researcher');

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface TrendData {
  query: string;
  interest: 'low' | 'medium' | 'high' | 'very_high';
  trend: 'rising' | 'stable' | 'declining';
}

// Analyze a niche idea using Google search to understand the market
export async function analyzeNicheTrends(niche: string): Promise<TrendData[]> {
  const queries = [
    `${niche} near me`,
    `best ${niche} services`,
    `${niche} directory`,
    `${niche} business`,
  ];

  const results: TrendData[] = [];

  for (const query of queries) {
    try {
      const searchResults = await searchGoogle(query);
      const hasDirectories = searchResults.some(r =>
        r.title.toLowerCase().includes('directory') ||
        r.title.toLowerCase().includes('list')
      );

      results.push({
        query,
        interest: hasDirectories ? 'low' : 'high',
        trend: 'stable',
      });
    } catch (error) {
      logger.warn({ query, error }, 'Failed to search for trend data');
    }
  }

  return results;
}

// Expand niche idea into related keywords
export async function expandNicheKeywords(niche: string): Promise<string[]> {
  const systemPrompt = `You are a keyword research expert. Given a niche idea, expand it into 10-15 related search queries that people would use to find businesses in this niche. Focus on:
- Different variations of the main query
- Local search intent (near me, in [city])
- Service-specific terms
- Problem/solution framing

Return ONLY a JSON array of strings, nothing else.`;

  const userPrompt = `Niche: ${niche}`;

  const result = await callAIWithPrompt(
    'niche_research' as TaskType,
    systemPrompt,
    userPrompt,
    { jsonResponse: true }
  );

  try {
    // Try to parse JSON array from response
    const cleaned = result.content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Fallback: split by newlines
    return result.content
      .split('\n')
      .map(line => line.replace(/^[\d\.\-\*]+\s*/, '').trim())
      .filter(Boolean);
  }

  return [];
}

// Get search volume estimate
export async function estimateSearchVolume(keyword: string): Promise<number> {
  try {
    const results = await searchGoogle(keyword);
    const info = results[0]; // Google's searchInfo gives estimate

    // This is approximate - Google doesn't give exact numbers via CSE
    if (results.length > 0) {
      // Return a rough estimate based on result count
      return results.length * 1000;
    }
  } catch (error) {
    logger.warn({ keyword, error }, 'Failed to estimate search volume');
  }

  return 0;
}
