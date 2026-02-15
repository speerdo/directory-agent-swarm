import { callOpenRouter, getAnthropicClient, getGoogleClient } from './providers.js';
import { trackCost } from '../utils/cost-tracker.js';

// Task types and model mapping from spec Section 3
export type TaskType =
  | 'extract_names'        // Gemma 3 — $0.04/M
  | 'classify_boolean'     // Gemma 3 — $0.04/M
  | 'verify_business'     // MiniMax M2.5 — $0.15/M
  | 'generate_description'// MiniMax M2.5 — $0.15/M
  | 'generate_meta'       // MiniMax M2.5 — $0.15/M
  | 'generate_city_page'  // MiniMax M2.5 — $0.15/M
  | 'generate_blog'       // Claude Sonnet 4.5 — free (Pro sub)
  | 'uncertain_judgment'  // GLM-5 — $0.80/M (lowest hallucination)
  | 'niche_research'      // GLM-5 — $0.80/M
  | 'qa_judge'            // Claude Haiku 4.5 — $0.80/M
  | 'visual_qa'           // Kimi K2.5 — $0.50/M (screenshots)
  | 'generate_schema'     // Devstral — $0.05/M
  | 'summarize_status'    // Gemini Flash — FREE
  | 'parse_command';      // Gemini Flash — FREE

export interface ModelConfig {
  model: string;
  provider: 'openrouter' | 'anthropic' | 'google';
}

export const MODEL_MAP: Record<TaskType, ModelConfig> = {
  extract_names:        { model: 'google/gemma-3-27b-it',  provider: 'openrouter' },
  classify_boolean:     { model: 'google/gemma-3-27b-it',  provider: 'openrouter' },
  verify_business:      { model: 'minimax/minimax-m2.5',   provider: 'openrouter' },
  generate_description: { model: 'minimax/minimax-m2.5',   provider: 'openrouter' },
  generate_meta:        { model: 'minimax/minimax-m2.5',   provider: 'openrouter' },
  generate_city_page:   { model: 'minimax/minimax-m2.5',   provider: 'openrouter' },
  generate_blog:        { model: 'claude-sonnet-4-5-20250514', provider: 'anthropic' },
  uncertain_judgment:   { model: 'zhipu/glm-5-preview-0528', provider: 'openrouter' },
  niche_research:       { model: 'zhipu/glm-5-preview-0528', provider: 'openrouter' },
  qa_judge:            { model: 'anthropic/claude-haiku-4-2025-01-15', provider: 'openrouter' },
  visual_qa:           { model: 'moonshotai/kimi-k2.5',   provider: 'openrouter' },
  generate_schema:      { model: 'mistralai/devstral-small-2505', provider: 'openrouter' },
  summarize_status:     { model: 'gemini-2.5-flash',       provider: 'google' },
  parse_command:        { model: 'gemini-2.5-flash',       provider: 'google' },
};

export interface CallAIOptions {
  task: TaskType;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  jsonResponse?: boolean;
  nicheId?: string;
  agent?: string;
}

export interface CallAIResult {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  provider: 'openrouter' | 'anthropic' | 'google';
}

export async function callAI(options: CallAIOptions): Promise<CallAIResult> {
  const config = MODEL_MAP[options.task];
  const { model, provider } = config;

  let result: CallAIResult;
  if (provider === 'openrouter') {
    result = await callOpenRouterHandler(options, model);
  } else if (provider === 'anthropic') {
    result = await callAnthropicHandler(options, model);
  } else {
    result = await callGoogleHandler(options, model);
  }

  // Automatically track costs when usage data is available
  if (result.usage) {
    trackCost(model, result.usage.inputTokens, result.usage.outputTokens, {
      taskType: options.task,
      nicheId: options.nicheId,
      agent: options.agent,
    }).catch(() => {}); // Fire-and-forget — don't block AI calls on cost tracking
  }

  return result;
}

async function callOpenRouterHandler(options: CallAIOptions, model: string) {
  const result = await callOpenRouter(options.messages, {
    model,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    jsonResponse: options.jsonResponse,
  });

  return {
    content: result.content,
    usage: result.usage,
    model,
    provider: 'openrouter' as const,
  };
}

async function callAnthropicHandler(options: CallAIOptions, model: string): Promise<CallAIResult> {
  const client = getAnthropicClient();

  // Convert messages to Anthropic format
  const systemMessage = options.messages.find(m => m.role === 'system')?.content ?? '';
  const otherMessages = options.messages.filter(m => m.role !== 'system');

  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    system: systemMessage,
    messages: otherMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  const content = response.content[0]?.type === 'text'
    ? response.content[0].text
    : '';

  return {
    content,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    model,
    provider: 'anthropic',
  };
}

async function callGoogleHandler(options: CallAIOptions, model: string): Promise<CallAIResult> {
  const client = getGoogleClient();

  const systemMessage = options.messages.find(m => m.role === 'system')?.content;
  const userMessages = options.messages.filter(m => m.role !== 'system');

  const geminiModel = client.getGenerativeModel({
    model,
    ...(systemMessage ? { systemInstruction: systemMessage } : {}),
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 4096,
      responseMimeType: options.jsonResponse ? 'application/json' : 'text/plain',
    },
  });

  const prompt = userMessages
    .map(m => m.content)
    .join('\n\n');

  const result = await geminiModel.generateContent(prompt);
  const response = result.response;
  const content = response.text() ?? '';
  const usageMetadata = response.usageMetadata;

  return {
    content,
    usage: usageMetadata ? {
      inputTokens: usageMetadata.promptTokenCount ?? 0,
      outputTokens: usageMetadata.candidatesTokenCount ?? 0,
    } : undefined,
    model,
    provider: 'google',
  };
}

// Convenience function for simple prompts
export async function callAIWithPrompt(
  task: TaskType,
  systemPrompt: string,
  userPrompt: string,
  options?: Partial<CallAIOptions>
): Promise<CallAIResult> {
  return callAI({
    task,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    ...options,
  });
}
