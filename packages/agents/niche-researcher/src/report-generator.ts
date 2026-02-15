import { type OpportunityScore, interpretScore } from './opportunity-score.js';
import { type CompetitorAnalysis, gradeCompetition } from './competitor-scan.js';
import { type TrendData } from './search-strategy.js';

export interface NicheReport {
  niche: string;
  generatedAt: Date;
  opportunityScore: OpportunityScore;
  competitorAnalysis: CompetitorAnalysis;
  trendData: TrendData[];
  interpretation: {
    verdict: 'excellent' | 'good' | 'moderate' | 'poor';
    recommendation: string;
    riskFactors: string[];
  };
}

// Generate a human-readable report
export function generateReport(
  niche: string,
  opportunityScore: OpportunityScore,
  competitorAnalysis: CompetitorAnalysis,
  trendData: TrendData[]
): NicheReport {
  const interpretation = interpretScore(opportunityScore);

  return {
    niche,
    generatedAt: new Date(),
    opportunityScore,
    competitorAnalysis,
    trendData,
    interpretation,
  };
}

// Format report as markdown for display
export function formatReportAsMarkdown(report: NicheReport): string {
  const lines: string[] = [];

  lines.push(`# Niche Research Report: ${report.niche}`);
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt.toISOString()}`);
  lines.push('');

  // Opportunity Score Section
  lines.push('## Opportunity Score');
  lines.push('');
  lines.push(`**Overall Score: ${report.opportunityScore.totalScore}/100** — ${report.interpretation.verdict.toUpperCase()}`);
  lines.push('');
  lines.push('### Breakdown');
  lines.push('');
  lines.push(`| Factor | Score |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Search Volume | ${report.opportunityScore.factors.searchVolume}/20 |`);
  lines.push(`| Competition | ${report.opportunityScore.factors.competition}/20 |`);
  lines.push(`| Monetization | ${report.opportunityScore.factors.monetization}/20 |`);
  lines.push(`| Market Gap | ${report.opportunityScore.factors.marketGap}/20 |`);
  lines.push(`| Ease of Entry | ${report.opportunityScore.factors.difficulty}/20 |`);
  lines.push('');

  // Recommendation
  lines.push('## Recommendation');
  lines.push('');
  lines.push(report.interpretation.recommendation);
  lines.push('');

  // Risk Factors
  if (report.interpretation.riskFactors.length > 0) {
    lines.push('### Risk Factors');
    lines.push('');
    for (const risk of report.interpretation.riskFactors) {
      lines.push(`- ${risk}`);
    }
    lines.push('');
  }

  // Competition Analysis
  lines.push('## Competition Analysis');
  lines.push('');
  const grade = gradeCompetition(report.competitorAnalysis);
  lines.push(`**Grade: ${grade.grade}** — ${grade.summary}`);
  lines.push('');

  if (report.competitorAnalysis.competitors.length > 0) {
    lines.push('### Top Competitors');
    lines.push('');
    for (const competitor of report.competitorAnalysis.competitors.slice(0, 5)) {
      lines.push(`- [${competitor.name}](${competitor.url}) — Quality: ${competitor.quality}/10`);
    }
    lines.push('');
  }

  if (report.competitorAnalysis.overallGaps.length > 0) {
    lines.push('### Market Gaps Identified');
    lines.push('');
    for (const gap of report.competitorAnalysis.overallGaps) {
      lines.push(`- ${gap}`);
    }
    lines.push('');
  }

  // Quick Stats
  lines.push('## Quick Stats');
  lines.push('');
  lines.push(`- Estimated Search Volume: ~${report.opportunityScore.searchVolume.toLocaleString()}/month`);
  lines.push(`- Competitors Found: ${report.competitorAnalysis.competitors.length}`);
  lines.push(`- Competition Grade: ${report.opportunityScore.competitionGrade}`);
  lines.push('');

  return lines.join('\n');
}

// Format report as short summary for Telegram
export function formatReportAsSummary(report: NicheReport): string {
  const score = report.opportunityScore.totalScore;
  const grade = report.opportunityScore.competitionGrade;
  const competitors = report.competitorAnalysis.competitors.length;

  return `📊 *${report.niche}*
━━━━━━━━━━━━━━━━━━━━━━
Score: ${score}/100 (${report.interpretation.verdict})
Competition: ${grade} (${competitors} found)
Monetization: ${report.opportunityScore.factors.monetization}/20

${report.interpretation.recommendation}`;
}
