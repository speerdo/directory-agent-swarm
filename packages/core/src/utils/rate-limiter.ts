import { createLogger } from './logger.js';

const logger = createLogger('rate-limiter');

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // milliseconds
  identifier: string; // e.g., 'google-cse', 'google-places', 'openrouter'
}

// Simple in-memory rate limiter (for single-instance deployment)
// For multi-instance, use Redis-based rate limiting
class RateLimiter {
  private limits = new Map<string, { count: number; resetTime: number }>();

  constructor(private configs: RateLimitConfig[]) {}

  async checkLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const config = this.configs.find(c => c.identifier === identifier);
    if (!config) {
      // No limit configured for this identifier
      return { allowed: true, remaining: Infinity, resetIn: 0 };
    }

    const now = Date.now();
    const record = this.limits.get(identifier);

    if (!record || now > record.resetTime) {
      // New window
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetIn: config.windowMs,
      };
    }

    if (record.count >= config.maxRequests) {
      // Rate limited
      logger.warn({ identifier, remaining: 0, resetIn: record.resetTime - now }, 'Rate limit exceeded');
      return {
        allowed: false,
        remaining: 0,
        resetIn: record.resetTime - now,
      };
    }

    // Increment count
    record.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - record.count,
      resetIn: record.resetTime - now,
    };
  }

  async waitForLimit(identifier: string): Promise<void> {
    const result = await this.checkLimit(identifier);
    if (!result.allowed) {
      logger.info({ identifier, waitMs: result.resetIn }, 'Waiting for rate limit');
      await this.sleep(result.resetIn);
      return this.waitForLimit(identifier); // Check again after waiting
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getRemaining(identifier: string): number {
    const config = this.configs.find(c => c.identifier === identifier);
    if (!config) return Infinity;

    const record = this.limits.get(identifier);
    if (!record) return config.maxRequests;

    const now = Date.now();
    if (now > record.resetTime) return config.maxRequests;

    return Math.max(0, config.maxRequests - record.count);
  }

  getResetTime(identifier: string): number {
    const record = this.limits.get(identifier);
    if (!record) return 0;
    return Math.max(0, record.resetTime - Date.now());
  }
}

// Default rate limits based on spec
export const rateLimiter = new RateLimiter([
  // Google CSE: 100/day free tier
  { identifier: 'google-cse', maxRequests: 100, windowMs: 24 * 60 * 60 * 1000 },
  // Google Places: varies, first $200/month free
  { identifier: 'google-places', maxRequests: 1000, windowMs: 60 * 1000 }, // 1000 per minute (high limit, rely on billing)
  // OpenRouter: per-model rate limits, generally lenient
  { identifier: 'openrouter', maxRequests: 100, windowMs: 60 * 1000 },
  // SerpAPI: 100/month free, paid plans have higher limits
  { identifier: 'serp-api', maxRequests: 100, windowMs: 30 * 24 * 60 * 60 * 1000 }, // 100 per month
]);

// Simple helper to wrap a function with rate limiting
export async function withRateLimit<T>(
  identifier: string,
  fn: () => Promise<T>
): Promise<T> {
  await rateLimiter.waitForLimit(identifier);
  return fn();
}
