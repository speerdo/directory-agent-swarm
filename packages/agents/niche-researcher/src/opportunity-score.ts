import { type CompetitorAnalysis, gradeCompetition } from './competitor-scan.js';
import { type TrendData, estimateSearchVolume } from './search-strategy.js';
import { createLogger } from '@agent-swarm/core';

const logger = createLogger('opportunity-score');

export interface OpportunityScore {
  totalScore: number; // 1-100
  searchVolume: number;
  competitionGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  monetizationScore: number; // 1-20
  marketGapScore: number; // 1-20
  difficultyScore: number; // 1-20
  factors: {
    searchVolume: number; // 0-20
    competition: number; // 0-20
    monetization: number; // 1-20
    marketGap: number; // 1-20
    difficulty: number; // 1-20
  };
}

// Estimate monetization potential based on niche type
function estimateMonetization(niche: string): number {
  const nicheLower = niche.toLowerCase();

  // High-value niches
  if (nicheLower.includes('roof') || nicheLower.includes('hvac') || nicheLower.includes('plumb')) {
    return 18;
  }
  // Medium-high
  if (nicheLower.includes('auto') || nicheLower.includes('home improvement') || nicheLower.includes('landscape')) {
    return 15;
  }
  // Medium
  if (nicheLower.includes('pet') || nicheLower.includes('clean') || nicheLower.includes('repair')) {
    return 12;
  }
  // Lower
  if (nicheLower.includes('recycl') || nicheLower.includes('donation')) {
    return 8;
  }

  return 10; // Default
}

// Score difficulty (inverse of ease)
function scoreDifficulty(analysis: CompetitorAnalysis, trendData: TrendData[]): number {
  let difficulty = 10; // Base difficulty

  // More competitors = higher difficulty
  if (analysis.competitors.length > 5) difficulty += 5;
  if (analysis.competitors.length > 8) difficulty += 5;

  // High traffic competitors = harder
  const highTrafficCount = analysis.competitors.filter(c => c.estimatedTraffic === 'high').length;
  if (highTrafficCount > 3) difficulty += 5;

  // Rising trends = more competition coming
  const risingTrends = trendData.filter(t => t.trend === 'rising').length;
  if (risingTrends > 0) difficulty += 3;

  return Math.min(20, difficulty);
}

// Calculate final opportunity score
export async function calculateOpportunityScore(
  niche: string,
  analysis: CompetitorAnalysis,
  trendData: TrendData[]
): Promise<OpportunityScore> {
  // Search volume score (0-20)
  const keywords = [`${niche} near me`, `${niche} directory`];
  const volumes = await Promise.all(keywords.map(estimateSearchVolume));
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const searchVolumeScore = Math.min(20, Math.round(avgVolume / 5000));

  // Competition score (0-20, inverse - weak competition = high score)
  const competitionGrade = gradeCompetition(analysis);
  const competitionScore = competitionGrade.grade === 'A' ? 20 :
    competitionGrade.grade === 'B' ? 16 :
    competitionGrade.grade === 'C' ? 12 :
    competitionGrade.grade === 'D' ? 6 : 3;

  // Monetization score (1-20)
  const monetizationScore = estimateMonetization(niche);

  // Market gap score (1-20)
  const marketGapScore = analysis.overallGaps.length > 2 ? 18 :
    analysis.overallGaps.length > 0 ? 14 : 8;

  // Difficulty score (1-20, inverse - easy = high score)
  const difficultyRaw = scoreDifficulty(analysis, trendData);
  const difficultyScore = 21 - difficultyRaw; // Invert: low difficulty = high score

  // Calculate totals
  const totalScore = searchVolumeScore + competitionScore + monetizationScore + marketGapScore + difficultyScore;

  // Normalize to 1-100
  const normalizedScore = Math.min(100, Math.max(1, totalScore));

  logger.info({
    niche,
    score: normalizedScore,
    breakdown: { searchVolumeScore, competitionScore, monetizationScore, marketGapScore, difficultyScore },
  }, 'Calculated opportunity score');

  return {
    totalScore: normalizedScore,
    searchVolume: avgVolume,
    competitionGrade: competitionGrade.grade,
    monetizationScore,
    marketGapScore,
    difficultyScore,
    factors: {
      searchVolume: searchVolumeScore,
      competition: competitionScore,
      monetization: monetizationScore,
      marketGap: marketGapScore,
      difficulty: difficultyScore,
    },
  };
}

// Interpret score into actionable advice
export function interpretScore(score: OpportunityScore): {
  verdict: 'excellent' | 'good' | 'moderate' | 'poor';
  recommendation: string;
  riskFactors: string[];
} {
  const riskFactors: string[] = [];

  if (score.factors.searchVolume < 10) {
    riskFactors.push('Low search volume may limit traffic');
  }
  if (score.competitionGrade === 'D' || score.competitionGrade === 'F') {
    riskFactors.push('Strong existing competition');
  }
  if (score.factors.monetization < 10) {
    riskFactors.push('Limited monetization potential');
  }
  if (score.factors.difficulty < 10) {
    riskFactors.push('Technical or resource-intensive niche');
  }

  let verdict: 'excellent' | 'good' | 'moderate' | 'poor';
  let recommendation: string;

  if (score.totalScore >= 80) {
    verdict = 'excellent';
    recommendation = 'Strong opportunity - pursue immediately';
  } else if (score.totalScore >= 60) {
    verdict = 'good';
    recommendation = 'Good opportunity with some caveats - worth pursuing';
  } else if (score.totalScore >= 40) {
    verdict = 'moderate';
    recommendation = 'Moderate opportunity - research further before committing';
  } else {
    verdict = 'poor';
    recommendation = 'Weak opportunity - consider alternatives';
  }

  return { verdict, recommendation, riskFactors };
}
