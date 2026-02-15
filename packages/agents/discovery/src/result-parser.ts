import { callAIWithPrompt, type TaskType, type SearchResult } from '@agent-swarm/core';
import { createLogger } from '@agent-swarm/core';

const logger = createLogger('result-parser');

export interface ParsedBusiness {
  name: string;
  sourceSnippet: string;
  sourceUrl?: string;
  confidence: number; // 0-1
}

// Extract business names from search results using Gemma 3
export async function extractBusinessNames(
  searchResults: SearchResult[],
  niche: string
): Promise<ParsedBusiness[]> {
  if (searchResults.length === 0) {
    return [];
  }

  // Prepare search results for the AI
  const resultsText = searchResults
    .map((r, i) => `${i + 1}. Title: ${r.title}\n   URL: ${r.link}\n   Snippet: ${r.snippet}`)
    .join('\n\n');

  const systemPrompt = `You are a business data extraction expert. Given search results for "${niche}" businesses, extract the names of actual businesses that provide ${niche} services.

Return ONLY a JSON array of objects with this exact structure:
[
  {"name": "Business Name", "sourceSnippet": "Relevant snippet", "sourceUrl": "https://...", "confidence": 0.9}
]

Rules:
- Only include actual businesses (companies, organizations), not articles or blog posts
- Set confidence to 1.0 if the business clearly provides ${niche} services
- Set confidence to 0.5-0.7 if uncertain but likely relevant
- Set confidence to 0 if clearly not a relevant business
- Include the source URL when available
- Do NOT include duplicates
- If no valid businesses found, return an empty array []`;

  const userPrompt = `Search Results:\n${resultsText}`;

  try {
    const result = await callAIWithPrompt(
      'extract_names' as TaskType,
      systemPrompt,
      userPrompt,
      { jsonResponse: true }
    );

    // Parse the JSON response
    const cleaned = result.content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed)) {
      const businesses: ParsedBusiness[] = parsed
        .filter(b => b.confidence >= 0.5)
        .map(b => ({
          name: b.name,
          sourceSnippet: b.sourceSnippet || '',
          sourceUrl: b.sourceUrl,
          confidence: b.confidence,
        }));

      logger.info({ inputCount: searchResults.length, outputCount: businesses.length }, 'Extracted businesses');
      return businesses;
    }
  } catch (error) {
    logger.error({ error }, 'Failed to parse business names from search results');
  }

  // Fallback: try simple extraction from titles
  return extractFromTitles(searchResults);
}

// Fallback: simple title-based extraction
function extractFromTitles(results: SearchResult[]): ParsedBusiness[] {
  const businesses: ParsedBusiness[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    // Skip if title looks like an article or list
    const title = result.title.toLowerCase();
    if (
      title.includes('article') ||
      title.includes('blog') ||
      title.includes('news') ||
      title.includes('how to') ||
      title.includes('guide') ||
      title.includes('list of') ||
      title.includes('top 10') ||
      title.includes('best of')
    ) {
      continue;
    }

    // Clean up the name
    const name = result.title
      .replace(/[-|].*$/, '') // Remove everything after hyphen or pipe
      .replace(/\d+\.\s*/, '') // Remove leading numbers
      .trim();

    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      businesses.push({
        name,
        sourceSnippet: result.snippet,
        sourceUrl: result.link,
        confidence: 0.7,
      });
    }
  }

  return businesses;
}

// Parse results from multiple queries and deduplicate within the batch
export async function parseAllSearchResults(
  queryResults: Map<string, SearchResult[]>,
  niche: string
): Promise<ParsedBusiness[]> {
  const allBusinesses: ParsedBusiness[] = [];
  const seenNames = new Set<string>();

  for (const [query, results] of queryResults) {
    const businesses = await extractBusinessNames(results, niche);
    for (const business of businesses) {
      const normalizedName = business.name.toLowerCase().trim();
      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        allBusinesses.push(business);
      }
    }
  }

  return allBusinesses;
}
