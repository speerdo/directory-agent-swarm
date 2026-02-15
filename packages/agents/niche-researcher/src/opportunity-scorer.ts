import { type TrendData, estimateSearchVolume } from './search-strategy.js';
import { type CompetitorAnalysis, gradeCompetition } from './competitor-scan.js';
import { callAIWithPrompt, type TaskType } from '@agent-swarm/core';

export interface OpportunityScore {
  total: number; // 1-100
  searchVolume: number; // 0-30
  competition: number; // 0-30
  monetization: number; // 0-20
  difficulty: number; // 0-20
}

// Calculate opportunity score for a niche
export async function calculateOpportunityScore(
  niche: string,
  trends: TrendData[],
  competitorAnalysis: CompetitorAnalysis
): Promise<OpportunityScore> {
  // Search volume score (0-30)
  const keywords = trends.map(t => t.query);
  let totalVolume = 0;

  for (const keyword of keywords.slice(0, 5)) {
    const volume = await estimateSearchVolume(keyword);
    totalVolume += volume;
  }

  const searchVolumeScore = Math.min(30, Math.floor(totalVolume / 10000));

  // Competition score (0-30) - inverse of competitor quality
  const { grade } = gradeCompetition(competitorAnalysis);
  const competitionScore = grade === 'A' ? 30 : grade === 'B' ? 22 : grade === 'C' ? 15 : grade === 'D' ? 8 : 3;

  // Monetization score (0-20) - use AI to estimate
  const monetizationScore = await estimateMonetization(niche);

  // Difficulty score (0-20) - based on barriers to entry
  const difficultyScore = calculateDifficultyScore(competitorAnalysis);

  const total = searchVolumeScore + competitionScore + monetizationScore + difficultyScore;

  return {
    total: Math.min(100, total),
    searchVolume: searchVolumeScore,
    competition: competitionScore,
    monetization: monetizationScore,
    difficulty: difficultyScore,
  };
}

// Estimate monetization potential using AI
async function estimateMonetization(niche: string): Promise<number> {
  const systemPrompt = `You are a business analyst. Estimate the monetization potential for a local service directory in this niche.

Consider:
- Affiliate programs available (local service businesses often have partnerships)
- Ad revenue potential (CPM estimates for local service keywords: $10-25)
- Lead generation value (businesses pay for leads)
- E-commerce potential

Rate monetization potential from 0-20:
- 0-5: Low (no clear monetization)
- 6-10: Moderate (some affiliate or ad potential)
- 11-15: Good (multiple revenue streams)
- 16-20: Excellent (high-value leads + affiliate + ads)

Return ONLY a number from 0-20, nothing else.`;

  const result = await callAIWithPrompt(
    'niche_research' as TaskType,
    systemPrompt,
    `Niche: ${niche}`,
    { jsonResponse: false }
  );

  const parsed = parseInt(result.content.trim(), 10);
  if (!isNaN(parsed) && parsed >= 0 && parsed <= 20) {
    return parsed;
  }

  return 10; // Default moderate score
}

// Calculate difficulty score based on barriers
function calculateDifficultyScore(analysis: CompetitorAnalysis): number {
  // Lower is easier (higher score)
  const avgQuality = analysis.competitors.reduce((sum, c) => sum + c.quality, 0) / (analysis.competitors.length || 1);

  // If high quality competitors exist, it's harder
  if (avgQuality >= 8) return 5;
  if (avgQuality >= 6) return 10;
  if (avgQuality >= 4) return 15;

  // Few competitors = easier
  return 20;
}

// Get recommendation based on score
export function getRecommendation(score: TotalOpportunityScore): {
  action: 'approve' | 'consider' | 'reject';
  reason: string;
} {
  if (score.total >= 70) {
    return { action: 'approve', reason: 'Strong opportunity' };
  }
  if (score.total >= 50) {
    return { action: 'consider', reason: 'Moderate opportunity, worth testing' };
  }
  return { action: 'reject', reason: 'Weak opportunity' };
}

type TotalOpportunityScore = OpportunityScore;
