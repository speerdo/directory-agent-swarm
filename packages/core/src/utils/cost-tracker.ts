import { createLogger } from './logger.js';
import { recordAIUsage } from '../db/queries.js';

const logger = createLogger('cost-tracker');

// Pricing per 1M tokens (from spec Section 3)
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenRouter models
  'google/gemma-3-27b-it': { input: 0.04, output: 0.08 },
  'minimax/minimax-m2.5': { input: 0.15, output: 1.20 },
  'zhipu/glm-5-preview-0528': { input: 0.80, output: 3.20 },
  'moonshotai/kimi-k2.5': { input: 0.50, output: 2.80 },
  'mistralai/devstral-small-2505': { input: 0.05, output: 0.08 },
  'anthropic/claude-haiku-4-2025-01-15': { input: 0.80, output: 4.00 },
  // Anthropic direct (Pro sub)
  'claude-sonnet-4-5-20250514': { input: 0, output: 0 }, // Free via Pro sub
  // Google direct (Pixel sub)
  'gemini-2.5-flash': { input: 0, output: 0 }, // Free via Pixel sub
};

export interface CostTrackerOptions {
  nicheId?: string;
  agent?: string;
  taskType: string;
}

// Track costs in memory for quick access
const sessionCosts = new Map<string, number>();

export async function trackCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  options: CostTrackerOptions
): Promise<number> {
  const pricing = PRICING[model];
  if (!pricing) {
    logger.warn({ model }, 'No pricing found for model');
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  // Record in database
  try {
    await recordAIUsage({
      task_type: options.taskType,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: totalCost,
      latency_ms: null,
      niche_id: options.nicheId ?? null,
      agent: options.agent ?? null,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to record AI usage');
  }

  // Track session cost
  const sessionKey = `${options.nicheId ?? 'unknown'}:${model}`;
  const currentCost = sessionCosts.get(sessionKey) ?? 0;
  sessionCosts.set(sessionKey, currentCost + totalCost);

  logger.debug(
    { model, inputTokens, outputTokens, cost: totalCost },
    'AI cost tracked'
  );

  return totalCost;
}

export function getSessionCost(nicheId: string, model?: string): number {
  if (model) {
    return sessionCosts.get(`${nicheId}:${model}`) ?? 0;
  }

  // Sum all costs for this niche
  let total = 0;
  for (const [key, cost] of sessionCosts) {
    if (key.startsWith(`${nicheId}:`)) {
      total += cost;
    }
  }
  return total;
}

export function getTotalSessionCost(): number {
  let total = 0;
  for (const cost of sessionCosts.values()) {
    total += cost;
  }
  return total;
}

export function clearSessionCosts(): void {
  sessionCosts.clear();
}

export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

export function getModelPricing(model: string): { input: number; output: number } | undefined {
  return PRICING[model];
}
