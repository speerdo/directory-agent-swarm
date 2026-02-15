import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// OpenRouter client - direct HTTP calls (OpenRouter is OpenAI-compatible)
export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const OpenRouterResponseSchema = z.object({
  id: z.string(),
  choices: z.array(z.object({
    message: z.object({
      role: z.string(),
      content: z.string(),
    }),
  })),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
  }).optional(),
});

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options: {
    model: string;
    temperature?: number;
    max_tokens?: number;
    jsonResponse?: boolean;
  }
): Promise<{ content: string; usage?: { inputTokens: number; outputTokens: number } }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://creativebandit.studio',
      'X-Title': 'Directory Swarm',
      'X-Provider-Allow': 'Fireworks,Together,Novita', // Force US-based inference
    },
    body: JSON.stringify({
      model: options.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4096,
      ...(options.jsonResponse ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${error}`);
  }

  const data = OpenRouterResponseSchema.parse(await response.json());

  const content = data.choices[0]?.message?.content ?? '';

  return {
    content,
    usage: data.usage ? {
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    } : undefined,
  };
}

// Anthropic client for Claude (direct, via Pro sub)
export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }

  return new Anthropic({ apiKey });
}

// Google Generative AI client for Gemini Flash (direct, via Pixel sub)
export function createGoogleClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY is required');
  }

  return new GoogleGenerativeAI(apiKey);
}

// Singleton instances (lazy initialized)
let _anthropic: Anthropic | undefined;
let _google: GoogleGenerativeAI | undefined;

export function getAnthropicClient() {
  if (!_anthropic) {
    _anthropic = createAnthropicClient();
  }
  return _anthropic;
}

export function getGoogleClient() {
  if (!_google) {
    _google = createGoogleClient();
  }
  return _google;
}
