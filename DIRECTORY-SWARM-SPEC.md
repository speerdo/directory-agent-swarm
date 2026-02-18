# Directory Swarm — Engineering Specification

> Drop this file into your AI IDE (Cursor, Claude Code) as project context.
> It contains everything needed to scaffold and build the system.

---

## 1. Project Overview

**What:** An AI agent swarm that discovers profitable directory niches, finds businesses in 500+ US cities, verifies them via Google Places API, enriches them with AI-generated content, and deploys SEO-optimized Astro static sites to Vercel.

**Existing proof of concept:** RecycleOldTech.com — a nationwide electronics recycling directory generating ~$100/mo passive income from 14K+ monthly visitors. This system automates the creation of similar directories at scale.

**Goal:** 5 directories live within 3 months, each generating $500-1,500/mo from ads + affiliate links. Total human involvement after build: ~15 min/day reviewing UNCERTAIN listings.

---

## 2. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Language** | TypeScript (strict mode) | Owner is a Node.js developer. All SDKs (Alpaca, OpenRouter, Neon) are TS-native. |
| **Monorepo** | npm workspaces | Agents share core utils (AI router, DB client, types). Each agent is its own package. |
| **Job Queue** | BullMQ (Redis-backed) | Reliable scheduling, retries, rate limiting, concurrency. Bull Board for monitoring dashboard. |
| **Database** | Neon (PostgreSQL) | Serverless PostgreSQL with connection pooling. 512MB storage on free tier.|
| **AI Routing** | Custom `router.ts` (~100 lines) + OpenRouter API | One function: `callAI(task, messages)` → routes to correct model. OpenRouter gives unified API to 11 models. |
| **Site Framework** | Astro (SSG mode) | Static site generation. Parameterized template reused across all niches. Excellent SEO defaults. |
| **Site Hosting** | Vercel (free tier per site) | Already using for RecycleOldTech. One Vercel project per directory. 100K+ pageviews free. |
| **Agent Hosting** | Local dev (Pop!_OS) → $6/mo DigitalOcean droplet for prod | Agents are lightweight Node.js + Redis. No GPU — all inference via API. |
| **Notifications** | Telegram Bot API | Status reports, approval requests, remote commands. Single bot for all ventures. |
| **CLI** | Commander.js | `swarm niche research "idea"` / `swarm pipeline start` / `swarm approve --batch` |

---

## 3. AI Model Architecture (v2)

All models accessed via OpenRouter unless noted. Use `X-Provider-Allow: 'Fireworks,Together,Novita'` header to force US-based inference for Chinese-origin models (same pricing, US data processing).

### Model Roster

| Model | Provider | Cost (input/output per M tokens) | Role in System |
|-------|----------|----------------------------------|----------------|
| **Gemma 3 27B** | Google (via OpenRouter) | $0.04 / $0.08 | Cheapest extraction. Simple name parsing, boolean flags. |
| **MiniMax M2.5** | MiniMax (via OpenRouter/Fireworks US) | $0.15 / $1.20 | Primary workhorse. Best tool calling (76.8% BFCL). Verification, descriptions, city pages, meta tags. 230B MoE, 10B active. |
| **GLM-5** | Zhipu AI (via OpenRouter/Fireworks US) | $0.80 / $3.20 | Reasoning & decision layer. Lowest hallucination rate. UNCERTAIN escalation, niche research scoring, strategic analysis. |
| **Kimi K2.5** | Moonshot AI (via OpenRouter/Fireworks US) | $0.50 / $2.80 | Multimodal specialist. 262K context. Screenshot verification of deployed directory pages (visual QA). |
| **Devstral Small** | Mistral (via OpenRouter) | $0.05 / $0.08 | Structured code output. Schema.org JSON-LD generation. |
| **Claude Haiku 4.5** | Anthropic (via OpenRouter) | $0.80 / $4.00 | QA judge. Quality spot-checks on generated descriptions. |
| **Claude Sonnet 4.5** | Anthropic (direct, free via Pro sub) | FREE (Pro sub) | Blog post generation. Complex judgment escalation. Highest quality for human-facing content. |
| **Gemini 2.5 Flash** | Google (direct, free via Pixel sub) | FREE (Pixel sub) | Supervisor summaries, command parsing, status reports. 1M context. |

### Task → Model Routing Table

This is the core of `packages/core/src/ai/router.ts`:

```typescript
type TaskType =
  | 'extract_names'        // Gemma 3 — $0.04/M
  | 'classify_boolean'     // Gemma 3 — $0.04/M
  | 'verify_business'      // MiniMax M2.5 — $0.15/M
  | 'generate_description' // MiniMax M2.5 — $0.15/M
  | 'generate_meta'        // MiniMax M2.5 — $0.15/M
  | 'generate_city_page'   // MiniMax M2.5 — $0.15/M
  | 'generate_blog'        // Claude Sonnet 4.5 — free (Pro sub)
  | 'uncertain_judgment'   // GLM-5 — $0.80/M (lowest hallucination)
  | 'niche_research'       // GLM-5 — $0.80/M
  | 'qa_judge'             // Claude Haiku 4.5 — $0.80/M
  | 'visual_qa'            // Kimi K2.5 — $0.50/M (screenshots)
  | 'generate_schema'      // Devstral — $0.05/M
  | 'summarize_status'     // Gemini Flash — FREE
  | 'parse_command';       // Gemini Flash — FREE

const MODEL_MAP: Record<TaskType, { model: string; provider: string }> = {
  extract_names:        { model: 'google/gemma-3-27b-it',  provider: 'openrouter' },
  classify_boolean:     { model: 'google/gemma-3-27b-it',  provider: 'openrouter' },
  verify_business:      { model: 'minimax/minimax-m2.5',   provider: 'openrouter' },
  generate_description: { model: 'minimax/minimax-m2.5',   provider: 'openrouter' },
  generate_meta:        { model: 'minimax/minimax-m2.5',   provider: 'openrouter' },
  generate_city_page:   { model: 'minimax/minimax-m2.5',   provider: 'openrouter' },
  generate_blog:        { model: 'claude-sonnet-4-5',      provider: 'anthropic'  },
  uncertain_judgment:   { model: 'zhipu/glm-5',            provider: 'openrouter' },
  niche_research:       { model: 'zhipu/glm-5',            provider: 'openrouter' },
  qa_judge:             { model: 'anthropic/claude-haiku',  provider: 'openrouter' },
  visual_qa:            { model: 'moonshotai/kimi-k2.5',   provider: 'openrouter' },
  generate_schema:      { model: 'mistralai/devstral',     provider: 'openrouter' },
  summarize_status:     { model: 'gemini-2.5-flash',       provider: 'google'     },
  parse_command:        { model: 'gemini-2.5-flash',       provider: 'google'     },
};
```

### OpenRouter Client Setup

```typescript
import { OpenAI } from 'openai';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://creativebandit.studio',
    'X-Title': 'Directory Swarm',
    'X-Provider-Allow': 'Fireworks,Together,Novita', // Force US-based inference
  },
});
```

---

## 4. Codebase Structure

```
directory-swarm/
├── package.json                    # npm workspaces monorepo root
├── tsconfig.base.json              # Shared TS config (strict: true)
├── .env.example                    # API keys template
├── docker-compose.yml              # Local dev: Redis
│
├── packages/
│   ├── core/                       # Shared utilities (all agents depend on this)
│   │   ├── package.json
│   │   └── src/
│   │       ├── ai/
│   │       │   ├── router.ts              # callAI(task, messages) → routes to model
│   │       │   ├── providers.ts           # OpenRouter, Anthropic, Google API clients
│   │       │   └── prompts/               # Prompt templates per agent per task
│   │       │       ├── discovery.ts
│   │       │       ├── verification.ts
│   │       │       ├── enrichment.ts
│   │       │       ├── content.ts
│   │       │       └── niche-research.ts
│   │       ├── db/
│   │       │   ├── client.ts              # Neon client singleton
│   │       │   ├── schema.ts              # TS types matching DB tables
│   │       │   └── queries.ts             # Reusable query functions
│   │       ├── apis/
│   │       │   ├── google-places.ts       # Places API: verify, get details, get reviews
│   │       │   ├── google-search.ts       # Custom Search API: search for businesses
│   │       │   └── serp.ts               # SerpAPI fallback if CSE quota exceeded
│   │       ├── queue/
│   │       │   ├── connection.ts          # Redis/BullMQ connection config
│   │       │   ├── queues.ts             # Queue definitions per agent
│   │       │   └── workers.ts            # Worker registration
│   │       └── utils/
│   │           ├── logger.ts              # Structured logging (pino)
│   │           ├── rate-limiter.ts        # Per-API rate limiting
│   │           └── cost-tracker.ts        # Track AI spend per agent per niche
│   │
│   ├── agents/
│   │   ├── niche-researcher/              # Discovers & scores profitable niches
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── index.ts               # Agent entry point + BullMQ worker
│   │   │       ├── search-strategy.ts     # Google Trends + keyword analysis
│   │   │       ├── competitor-scan.ts     # Find existing directories, grade quality
│   │   │       ├── opportunity-score.ts   # Multi-factor scoring (1-100)
│   │   │       └── report-generator.ts    # Human-readable opportunity report
│   │   │
│   │   ├── discovery/                     # Finds businesses in a niche + city
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── index.ts               # Agent entry + BullMQ worker
│   │   │       ├── search-queries.ts      # Generate niche-specific search queries
│   │   │       ├── result-parser.ts       # Extract business names from search results
│   │   │       └── deduplicator.ts        # Fuzzy match against existing DB entries
│   │   │
│   │   ├── verification/                  # Confirms businesses are real + relevant
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── index.ts
│   │   │       ├── places-verify.ts       # Google Places API confirmation
│   │   │       ├── review-analyzer.ts     # AI reads reviews for niche relevance
│   │   │       └── confidence-scorer.ts   # Classify: KEEP / REMOVE / UNCERTAIN
│   │   │
│   │   ├── enrichment/                    # Adds descriptions, flags, schema.org
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── index.ts
│   │   │       ├── description-gen.ts     # SEO descriptions per business
│   │   │       ├── flag-assigner.ts       # Boolean service flags from reviews
│   │   │       └── schema-gen.ts          # JSON-LD LocalBusiness structured data
│   │   │
│   │   ├── content/                       # City pages, blog posts, meta tags
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── index.ts
│   │   │       ├── city-page-gen.ts       # Unique landing page copy per city
│   │   │       ├── blog-gen.ts            # Long-form blog posts (2-3 per niche)
│   │   │       └── meta-gen.ts            # Title + description tags (batch)
│   │   │
│   │   ├── qa/                            # Quality assurance checks
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── index.ts
│   │   │       ├── description-qa.ts      # Sample 5%, judge description quality
│   │   │       ├── data-integrity.ts      # Validate phone/address format
│   │   │       └── duplicate-detect.ts    # Cross-city fuzzy duplicate detection
│   │   │
│   │   └── supervisor/                    # Orchestrates everything
│   │       ├── package.json
│   │       └── src/
│   │           ├── index.ts
│   │           ├── pipeline.ts            # Define stage order + dependencies
│   │           ├── scheduler.ts           # Cron scheduling per niche
│   │           ├── status-report.ts       # Daily summary generation
│   │           ├── command-parser.ts      # Parse natural language commands
│   │           └── approval-queue.ts      # Manage UNCERTAIN + approval items
│   │
│   ├── sites/
│   │   └── directory-template/            # Astro SSG template (parameterized)
│   │       ├── package.json
│   │       ├── astro.config.mjs
│   │       └── src/
│   │           ├── layouts/
│   │           │   └── BaseLayout.astro
│   │           ├── pages/
│   │           │   ├── index.astro            # Homepage
│   │           │   ├── [state]/
│   │           │   │   ├── index.astro        # State page
│   │           │   │   └── [city].astro       # City page (dynamic)
│   │           │   └── blog/
│   │           │       └── [slug].astro       # Blog post pages
│   │           ├── components/
│   │           │   ├── BusinessCard.astro
│   │           │   ├── CityList.astro
│   │           │   └── SearchBar.astro
│   │           └── styles/
│   │               └── global.css
│   │
│   └── cli/                               # Command interface
│       ├── package.json
│       └── src/
│           ├── index.ts                   # Entry: `swarm <command>`
│           ├── commands/
│           │   ├── niche.ts               # swarm niche research "mattress recycling"
│           │   ├── pipeline.ts            # swarm pipeline start/status/pause <niche>
│           │   ├── approve.ts             # swarm approve --batch / swarm approve <id>
│           │   ├── deploy.ts              # swarm deploy <niche>
│           │   └── report.ts              # swarm report daily / swarm report cost
│           └── telegram-bot.ts            # Same commands via Telegram messages
│
├── database/
│   └── migrations/
│       ├── 001_core_schema.sql
│       ├── 002_pipeline_schema.sql
│       └── 003_cost_tracking.sql
│
└── scripts/
    ├── seed-cities.ts                     # Load 500+ US cities with state, population, lat/lng
    └── seed-niche-config.ts               # Niche-specific query templates + service flags
```

---

## 5. Database Schema

### 001_core_schema.sql

```sql
CREATE TABLE cities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  state_code CHAR(2) NOT NULL,
  state_name TEXT NOT NULL,
  population INT,
  lat DECIMAL(9,6),
  lng DECIMAL(9,6),
  UNIQUE(name, state_code)
);

CREATE TABLE niches (
  id TEXT PRIMARY KEY,                    -- e.g. 'mattress-recycling'
  display_name TEXT NOT NULL,             -- e.g. 'Mattress Recycling'
  domain TEXT,                            -- e.g. 'mattressrecycling.directory'
  status TEXT DEFAULT 'researching',      -- researching | approved | building | live
  config JSONB DEFAULT '{}',             -- niche-specific: search queries, service flags, affiliate programs
  opportunity_score INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  niche_id TEXT REFERENCES niches(id),
  city_id INT REFERENCES cities(id),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  google_place_id TEXT,
  lat DECIMAL(9,6),
  lng DECIMAL(9,6),
  status TEXT DEFAULT 'discovered',       -- discovered | verified | enriched | live | removed
  confidence DECIMAL(3,2),                -- 0.00 to 1.00
  description TEXT,
  service_flags JSONB DEFAULT '{}',       -- e.g. {"pickup": true, "dropoff": false, "free_service": true}
  schema_json JSONB,                      -- JSON-LD LocalBusiness for SEO
  source TEXT,                            -- 'google_search' | 'places_api' | 'manual'
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  enriched_at TIMESTAMPTZ
);

CREATE INDEX idx_businesses_niche_city ON businesses(niche_id, city_id);
CREATE INDEX idx_businesses_status ON businesses(status);
CREATE INDEX idx_businesses_place_id ON businesses(google_place_id);
```

### 002_pipeline_schema.sql

```sql
CREATE TABLE pipeline_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  niche_id TEXT REFERENCES niches(id),
  agent TEXT NOT NULL,                    -- 'discovery' | 'verification' | 'enrichment' | etc.
  city_id INT REFERENCES cities(id),
  status TEXT DEFAULT 'queued',           -- queued | running | done | failed | paused
  input JSONB DEFAULT '{}',
  output JSONB DEFAULT '{}',
  error TEXT,
  attempts INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pipeline_niche_agent ON pipeline_jobs(niche_id, agent, status);

CREATE TABLE approval_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  agent TEXT NOT NULL,
  reason TEXT,                            -- Why it needs approval
  ai_recommendation TEXT,                 -- What the AI suggests (KEEP or REMOVE + reasoning)
  confidence DECIMAL(3,2),
  status TEXT DEFAULT 'pending',          -- pending | approved | rejected
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  niche_id TEXT REFERENCES niches(id),
  city_id INT REFERENCES cities(id),      -- NULL for blog posts
  content_type TEXT NOT NULL,             -- 'city_page' | 'blog_post' | 'meta_description'
  title TEXT,
  body TEXT,                              -- Markdown content
  meta_title TEXT,
  meta_description TEXT,
  slug TEXT,
  status TEXT DEFAULT 'draft',            -- draft | reviewed | published
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 003_cost_tracking.sql

```sql
CREATE TABLE ai_usage (
  id SERIAL PRIMARY KEY,
  task_type TEXT NOT NULL,                -- Matches TaskType enum
  model TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  cost_usd DECIMAL(8,6),
  latency_ms INT,
  niche_id TEXT,
  agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_niche ON ai_usage(niche_id, created_at);
CREATE INDEX idx_ai_usage_model ON ai_usage(model, created_at);
CREATE INDEX idx_ai_usage_date ON ai_usage(created_at);
```

---

## 6. Agent Specifications

### 6.1 Niche Researcher

**Purpose:** Discovers and scores profitable directory niches so you're not guessing what to build.

**Trigger:** Manual — `swarm niche research "mattress recycling"` or batch: `swarm niche research --file ideas.txt`

**Steps:**
1. Expand seed idea into 10-15 real search queries people use (GLM-5)
2. Search Google for existing directories in this niche, grade each on: coverage, freshness, UX, mobile, SEO (MiniMax M2.5 for scraping + GLM-5 for grading)
3. Estimate monetization: ad CPMs, affiliate programs, lead gen value (GLM-5)
4. Score opportunity 1-100 based on: search volume × weak competition × strong monetization (GLM-5)
5. Save to `niche_opportunities` table for human review

**Output:** Niche opportunity report with score, competitor analysis, monetization estimate, recommended action.

**Key prompt context to include:** "Compare to RecycleOldTech.com benchmarks: $60-120/mo ads at 14K monthly visitors. Prioritize niches where existing directories have poor mobile experience, outdated data, or weak city-level coverage."

### 6.2 Discovery Agent

**Purpose:** Finds candidate businesses for a given niche across all target cities.

**Trigger:** BullMQ job — fires when a niche pipeline starts. Processes cities in batches of 20.

**Steps:**
1. For each city, generate 6 niche-specific search queries (configured per niche in `niches.config`)
2. Execute via Google Custom Search API (100 free queries/day, $5/1000 after)
3. Parse search results with Gemma 3 to extract business names and addresses
4. Fuzzy-match against existing `businesses` table to avoid duplicates (Levenshtein distance + geocoding)
5. Insert new candidates with `status: 'discovered'`

**Models:** Gemma 3 ($0.04/M) for parsing. MiniMax M2.5 fallback for ambiguous results.

**Rate limiting:** Respect Google CSE quota (100/day free tier). Batch 20 cities per day = ~120 queries/day. At this rate, 500 cities takes ~25 days. Can accelerate with paid CSE ($5/1000 queries).

### 6.3 Verification Agent

**Purpose:** Confirms discovered businesses are real, currently operating, and relevant to the niche.

**Trigger:** BullMQ — fires when a discovery batch completes for a city.

**Steps:**
1. Look up each business via Google Places API (Text Search → get `place_id`)
2. Fetch place details: name, address, phone, website, hours, rating, reviews
3. Send batch of 10 businesses + their reviews to MiniMax M2.5 with prompt: "Classify each business as KEEP (definitely relevant), REMOVE (not relevant or permanently closed), or UNCERTAIN (ambiguous — needs human review). Return JSON."
4. UNCERTAIN items escalate to GLM-5 for a second opinion with reasoning
5. Still-UNCERTAIN items go to `approval_queue` for human review
6. Update `businesses` table with `status: 'verified'` or `status: 'removed'`

**Models:** MiniMax M2.5 ($0.15/M) for batch classification. GLM-5 ($0.80/M) for UNCERTAIN escalation (lowest hallucination — knows when to say "I don't know").

**Expected ratios:** ~50% KEEP, ~40% REMOVE, ~10% UNCERTAIN → ~5% final human review after GLM-5 second pass.

### 6.4 Enrichment Agent

**Purpose:** Adds SEO descriptions, boolean service flags, and Schema.org structured data to verified businesses.

**Trigger:** BullMQ — fires for each business with `status: 'verified'`.

**Steps:**
1. Generate 2-3 sentence SEO description using business name, address, reviews, and niche context (MiniMax M2.5, batches of 20)
2. Assign boolean service flags from review data (Gemma 3 — simple true/false: "Does this business offer pickup? Drop-off? Free service?")
3. Generate Schema.org `LocalBusiness` JSON-LD markup (Devstral — structured code output)
4. Update `businesses` with `status: 'enriched'`

**Models:** MiniMax M2.5 for descriptions, Gemma 3 for flags, Devstral for schema.

### 6.5 Content Agent

**Purpose:** Generates city landing pages, blog posts, and meta tags.

**Trigger:** BullMQ — fires when a city reaches 5+ verified businesses.

**Steps:**
1. City landing page: unique intro paragraph, local context, business count (MiniMax M2.5, batch 10 cities)
2. Blog posts: 1,000-1,500 word articles on niche topics for SEO (Claude Sonnet 4.5 via Pro sub — highest quality for human-facing content, 2-3 posts per niche)
3. Meta titles and descriptions: batch generate for all pages (MiniMax M2.5)
4. Insert into `content` table with `status: 'draft'`

**Models:** MiniMax M2.5 for city pages + meta. Claude Sonnet 4.5 for blog posts (free).

### 6.6 QA Agent

**Purpose:** Spot-checks output quality, flags data integrity issues, catches duplicates.

**Trigger:** BullMQ — fires after enrichment batches and content batches.

**Steps:**
1. Sample 5% of descriptions → send to Claude Haiku 4.5 to judge: tone, accuracy, SEO quality, uniqueness (score 1-10)
2. Run data integrity checks (pure code): phone format, address format, missing fields
3. Fuzzy duplicate detection across cities (pure code): same business listed in multiple nearby cities
4. Flag all issues in `qa_issues` table for human review

**Models:** Claude Haiku 4.5 for quality judgment. Pure code for data checks.

### 6.7 Supervisor Agent

**Purpose:** Orchestrates all agents, manages pipeline state, sends status reports, handles commands.

**Trigger:** Always running. Cron schedules + event-driven.

**Steps:**
1. Pipeline orchestration: define stage order and dependencies (pure code + BullMQ)
2. Daily status report: summarize progress across all niches → send via Telegram (Gemini Flash, free)
3. Command parsing: translate natural language Telegram messages to API calls (Gemini Flash, free)
4. Anomaly detection: flag cost spikes, quality drops, stuck jobs (Claude Haiku 4.5, only on anomalies)
5. Manage approval queue: batch UNCERTAIN items, send to Telegram for review

**Models:** Gemini Flash (free) for summaries + commands. Claude Haiku for anomalies.

---

## 7. Pipeline Flow

The full sequence from "I have an idea" to "live directory on Vercel":

```
Step 1: NICHE RESEARCHER
  Trigger:  Manual — `swarm niche research "mattress recycling"`
  Output:   niche_opportunities table entry with score
  Approval: YOU review and select top niches
     ↓
Step 2: SUPERVISOR creates pipeline
  Trigger:  Your approval — `swarm pipeline start mattress-recycling`
  Output:   pipeline_jobs queued + niche config saved
  Approval: Domain purchase needed
     ↓
Step 3: DISCOVERY searches 500 cities × 6 queries
  Trigger:  BullMQ — city batches (20 cities/day at free tier)
  Output:   ~25K candidate businesses in businesses table
  Approval: None — fully automated
     ↓
Step 4: VERIFICATION — Places API + AI classification
  Trigger:  BullMQ — fires when discovery batch completes per city
  Output:   businesses marked KEEP / REMOVE / UNCERTAIN
  Approval: UNCERTAIN batch review (~5 min/day via Telegram)
     ↓
Step 5: ENRICHMENT — descriptions + flags + schema
  Trigger:  BullMQ — fires for each KEEP business
  Output:   enriched business records
  Approval: None — automated
     ↓
Step 6: CONTENT — city pages + blog posts + meta tags
  Trigger:  BullMQ — fires when city reaches 5+ verified listings
  Output:   content table with markdown for each page
  Approval: Blog post spot-check only
     ↓
Step 7: QA — sample 5%, check data integrity
  Trigger:  BullMQ — after enrichment + content batches
  Output:   qa_issues table with flagged problems
  Approval: Review flagged items
     ↓
Step 8: SUPERVISOR builds Astro site → deploys to Vercel preview
  Trigger:  BullMQ — when niche has 100+ verified listings
  Output:   Vercel preview URL
  Approval: YOU review preview → approve for production
```

**Your total involvement per niche: 4 approval checkpoints across the entire process.**

---

## 8. Agent Communication Pattern

Agents communicate via **database state + BullMQ events**. They never call each other directly.

```
Discovery writes businesses (status: discovered)
  → triggers BullMQ event: 'city:discovery:complete'
    → Verification worker picks up job
      → writes businesses (status: verified/removed)
        → triggers 'city:verification:complete'
          → Enrichment worker picks up job
            → etc.
```

**Why this pattern:**
- Any agent can crash, restart, or be replaced without breaking the chain
- You can replay any step by re-queuing BullMQ jobs
- State is always inspectable via SQL queries
- No complex message bus or service mesh needed

---

## 9. Environment Variables

```env
# OpenRouter (all non-Google, non-Anthropic models)
OPENROUTER_API_KEY=sk-or-...

# Anthropic (Claude Sonnet via Pro sub, Claude Haiku via API)
ANTHROPIC_API_KEY=sk-ant-...

# Google (Gemini Flash, also used for Places + Custom Search)
GOOGLE_AI_API_KEY=...
GOOGLE_PLACES_API_KEY=...
GOOGLE_CSE_ID=...
GOOGLE_CSE_API_KEY=...

# Neon
NEON_DB_CONNECTION_STRING=postgresql://neondb_owner:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# Redis (local Docker or remote)
REDIS_URL=redis://localhost:6379

# Telegram Bot
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Vercel (for programmatic deploys)
VERCEL_TOKEN=...
VERCEL_ORG_ID=...
```

---

## 10. Key npm Dependencies

```json
{
  "dependencies": {
    "@database/database-js": "^2",
    "openai": "^4",
    "@anthropic-ai/sdk": "^0.30",
    "@google/generative-ai": "^0.20",
    "bullmq": "^5",
    "ioredis": "^5",
    "commander": "^12",
    "pino": "^9",
    "grammy": "^1",
    "fuse.js": "^7",
    "zod": "^3"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "tsx": "^4",
    "@types/node": "^22",
    "bull-board": "^5"
  }
}
```

**Notes:**
- `openai` SDK is used for OpenRouter (OpenAI-compatible API)
- `grammy` is the Telegram bot framework
- `fuse.js` for fuzzy string matching in deduplication
- `zod` for runtime validation of AI model outputs (critical — models return malformed JSON sometimes)

---

## 11. Build Plan (6 Weekends)

### Weekend 1: Foundation (~8-10h)
- [ ] Init monorepo with npm workspaces + TypeScript strict config
- [ ] Set up Neon project + run 3 migration files
- [ ] Build `packages/core/src/ai/router.ts` + `providers.ts`
- [ ] Build `packages/core/src/db/client.ts` + `schema.ts`
- [ ] Docker compose for local Redis
- [ ] Run `scripts/seed-cities.ts` (500 US cities from Census data)
- [ ] **Test:** Call each model via router, verify responses

### Weekend 2: Niche Researcher + Discovery (~8-10h)
- [ ] Build `agents/niche-researcher/` — all 4 source files
- [ ] Build `agents/discovery/` — search queries, result parser, deduplicator
- [ ] Set up BullMQ queues + workers for both agents
- [ ] **Test:** Research "mattress recycling" niche, get opportunity score
- [ ] **Test:** Discover businesses in 5 Ohio cities

### Weekend 3: Verification + Enrichment (~8-10h)
- [ ] Build `agents/verification/` — Places API verify, review analyzer, confidence scorer
- [ ] Build `agents/enrichment/` — description gen, flag assigner, schema gen
- [ ] Connect BullMQ pipeline: discovery → verification → enrichment
- [ ] **Test:** End-to-end pipeline for 1 city (Columbus, OH)

### Weekend 4: Content + QA + CLI (~8-10h)
- [ ] Build `agents/content/` — city page gen, blog gen, meta gen
- [ ] Build `agents/qa/` — description QA, data integrity, duplicate detect
- [ ] Build `cli/` with Commander.js — niche, pipeline, approve, report commands
- [ ] Set up Telegram bot (grammy) with same commands
- [ ] **Test:** Generate city page for Columbus + 1 blog post

### Weekend 5: Site Template + First Deploy (~6-8h)
- [ ] Adapt RecycleOldTech Astro template → parameterized `sites/directory-template/`
- [ ] Connect Astro to Neon for data at build time (fetch businesses, content)
- [ ] Build deploy script that: queries Neon → builds Astro → deploys to Vercel
- [ ] Set up $6 DigitalOcean droplet for production agents
- [ ] **Test:** Deploy mattress-recycling preview to Vercel

### Weekend 6: Scale + Polish (~6-8h)
- [ ] Run full pipeline: all 500 cities × mattress recycling niche
- [ ] Monitor costs via `ai_usage` table, tune prompts for quality + efficiency
- [ ] Deploy to production domain
- [ ] Build supervisor daily report (Telegram summary)
- [ ] Start researching niche #2 and #3 with Niche Researcher
- [ ] **Milestone:** First directory LIVE

### Post-Build Daily Routine (~15 min/day)
1. Check Telegram for overnight summary
2. Review 5-10 UNCERTAIN businesses in approval queue
3. Approve/reject via Telegram or CLI
4. Agents handle everything else

---

## 12. Estimated Costs

### One-Time Build Costs (AI)
| Model | Est. Tokens | Est. Cost | Usage |
|-------|------------|-----------|-------|
| MiniMax M2.5 | ~40M | $6-10 | Verification, descriptions, city pages (heaviest) |
| GLM-5 | ~5M | $4-8 | Niche research, UNCERTAIN escalation |
| Gemma 3 | ~30M | $1-3 | Simple extraction, boolean flags |
| Devstral | ~10M | $0.50-1 | Schema.org JSON-LD |
| Claude Haiku 4.5 | ~5M | $4-6 | QA spot-checks |
| Kimi K2.5 | ~2M | $1-3 | Visual QA (deployed page screenshots) |
| Claude Sonnet 4.5 | — | FREE | Blog posts (Pro sub) |
| Gemini Flash | — | FREE | Supervisor (Pixel sub) |
| **Total OpenRouter** | | **$17-31** | **One-time for first 5 directories** |

### Monthly Ongoing
| Item | Cost |
|------|------|
| DigitalOcean droplet | $6 |
| Re-verification AI (monthly) | $3-5 |
| Google Places API (overage) | $0-10 |
| Vercel hosting (per site) | $0 (free tier) |
| Neon | $0 (free tier) |
| **Total Monthly** | **$9-21** |

---

## 13. Security Notes

- All Chinese-origin models (MiniMax M2.5, GLM-5, Kimi K2.5) are routed through US-based providers via OpenRouter's `X-Provider-Allow` header (Fireworks AI in San Francisco). Data never touches Chinese servers.
- Data sent to cheap models is exclusively publicly available business information (names, addresses, reviews). Zero personal data, API keys, revenue figures, or strategic plans.
- Sensitive work (strategic analysis, blog content quality) goes through Claude (Anthropic servers, strong privacy guarantees).
- OpenRouter supports Zero Data Retention (ZDR) mode for additional paranoia.

---

## 14. Key Design Decisions Log

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Monorepo vs microservices | Monorepo | Shared types and utilities. Solo developer. No need for independent deployment. |
| BullMQ vs n8n for orchestration | BullMQ (programmatic) + n8n (Telegram/cron) | BullMQ gives precise control over retries, concurrency, priorities. n8n for simple triggers. |
| Astro vs Next.js for sites | Astro SSG | Static files = free hosting. No server needed. Better SEO defaults. Faster page loads. |
| Custom AI router vs LangChain | Custom 100-line router | No framework lock-in. Trivial to swap models. LangChain is overkill for routing. |
| MiniMax M2.5 vs DeepSeek V3.2 as workhorse | MiniMax M2.5 | M2.5 has 76.8% BFCL (tool calling) vs DeepSeek's lower score. Critical for multi-turn tool calling pipeline. Slightly cheaper input ($0.15 vs $0.20/M). |
| GLM-5 vs DeepSeek R1 for reasoning | GLM-5 | Lowest hallucination rate in industry (Omniscience -1). Knows when to say "I don't know" — critical for UNCERTAIN escalation. |
| US-hosted vs direct Chinese API | US-hosted via OpenRouter | Same price. `X-Provider-Allow` header routes to Fireworks (SF). Eliminates data sovereignty concern. |
