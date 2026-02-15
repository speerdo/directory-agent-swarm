// Discovery prompts for parsing search results

export const discoveryPrompts = {
  extractBusinessNames: (query: string, results: string) => `
Given a search query and Google search results, extract all business names and their addresses.

Search Query: ${query}

Search Results:
${results}

Extract the businesses in this exact JSON format:
{
  "businesses": [
    {
      "name": "Business Name",
      "address": "Full Street Address, City, State ZIP"
    }
  ]
}

Only include businesses that appear to be actual companies/services. Ignore news articles, blog posts, and directory listings that aren't businesses themselves.
`,
};

// Verification prompts for business classification

export const verificationPrompts = {
  classifyBusiness: (businessName: string, address: string, reviews: string, niche: string) => `
You are classifying a business for a ${niche} directory.

Business Name: ${businessName}
Address: ${address}

Recent Reviews:
${reviews}

Classify this business as one of:
- KEEP: Definitely relevant to ${niche} - they provide ${niche}-related services
- REMOVE: Not relevant - they don't provide ${niche} services, or they're permanently closed
- UNCERTAIN: You're not sure - ambiguous name, closed temporarily, or you need more information

Return a JSON object:
{
  "classification": "KEEP" | "REMOVE" | "UNCERTAIN",
  "reasoning": "Why you classified it this way",
  "confidence": 0.0-1.0
}

Be honest about uncertainty. It's better to mark UNCERTAIN than to guess wrong.
`,
};

// Enrichment prompts

export const enrichmentPrompts = {
  generateDescription: (businessName: string, address: string, reviews: string, niche: string, city: string, state: string) => `
Generate a 2-3 sentence SEO-friendly description for a ${niche} business.

Business: ${businessName}
Location: ${address}
City: ${city}, ${state}

Recent reviews for context:
${reviews}

Write in a professional, helpful tone. Include the city name naturally. Focus on what makes this business valuable to customers looking for ${niche} services.
`,

  extractServiceFlags: (businessName: string, reviews: string, niche: string) => `
Given a business name and reviews, extract boolean service flags.

Business: ${businessName}
Niche: ${niche}

Reviews:
${reviews}

Extract service flags as JSON:
{
  "pickup": true | false,
  "dropoff": true | false,
  "free_service": true | false,
  "residential": true | false,
  "commercial": true | false,
  "certified": true | false
}

Only set to true if explicitly mentioned in reviews or business name/description.
`,

  generateSchema: (businessName: string, address: string, phone: string, website: string, lat: number, lng: number) => `
Generate Schema.org LocalBusiness JSON-LD structured data.

Business Name: ${businessName}
Address: ${address}
Phone: ${phone}
Website: ${website}
Coordinates: ${lat}, ${lng}

Return ONLY valid JSON-LD (no markdown):
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  ...
}

Include appropriate @type based on the business name. Include all available fields.
`,
};

// Content generation prompts

export const contentPrompts = {
  generateCityPage: (city: string, state: string, businessCount: number, niche: string) => `
Write a unique introductory paragraph (2-3 sentences) for a city page about ${niche} services in ${city}, ${state}.

This page lists ${businessCount} businesses in ${city}.

Write in a friendly, helpful tone. Mention the city name naturally. Focus on why someone in ${city} would need these services.
`,

  generateMeta: (pageTitle: string, pageDescription: string) => `
Generate SEO meta title and description for a page.

Page Title: ${pageTitle}
Page Description: ${pageDescription}

Return JSON:
{
  "meta_title": "...",
  "meta_description": "..."
}

- Title: max 60 characters
- Description: max 160 characters
- Include relevant keywords naturally
`,
};

// Niche research prompts

export const nicheResearchPrompts = {
  expandNiche: (niche: string) => `
Given a niche idea, expand it into 10-15 real search queries that people would use when looking for these services.

Niche: ${niche}

Return JSON:
{
  "queries": [
    "${niche} in [city]",
    "best ${niche} near me",
    ...
  ]
}

Include variations: "in [city]", "near me", "near [major city]", "best", "top rated", etc.
`,

  scoreNiche: (niche: string, searchVolume: string, competition: string, monetization: string) => `
Score a niche opportunity from 1-100 based on:
- Search volume (how many people search for this)
- Competition (how good are existing directories)
- Monetization potential (ads, affiliates, lead gen)

Niche: ${niche}

Search Volume Analysis: ${searchVolume}
Competition Analysis: ${competition}
Monetization Analysis: ${monetization}

Return JSON:
{
  "score": 0-100,
  "search_volume_score": 0-100,
  "competition_score": 0-100,
  "monetization_score": 0-100,
  "summary": "Brief explanation of the score"
}

Compare to RecycleOldTech benchmarks: $60-120/mo ads at 14K monthly visitors.
`,
};

// QA prompts

export const qaPrompts = {
  judgeDescription: (businessName: string, description: string) => `
Judge the quality of a business description on a scale of 1-10.

Business: ${businessName}
Description: ${description}

Score based on:
- Accuracy (matches the business)
- Helpfulness (useful to customers)
- SEO (includes relevant keywords naturally)
- Uniqueness (not generic)

Return JSON:
{
  "score": 1-10,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1"]
}
`,
};
