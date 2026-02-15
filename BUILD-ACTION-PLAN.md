# Directory Swarm — Build Action Plan

> Follow this checklist to build the Directory Swarm system. Check off items as you complete them.
> Reference: `DIRECTORY-SWARM-SPEC.md` for full architecture details, model routing, and DB schema.

---

## Code Review Fixes (completed 2026-02-14)

The following bugs and improvements were found during a code review of the Weekend 1 foundation and fixed before proceeding:

### Critical Bugs Fixed
- [x] **`queries.ts`** — `getTotalCostByNiche()` and `getTotalCostByModel()` selected partial columns but parsed with full Zod schema (would crash at runtime). Fixed to use raw typed data instead.
- [x] **`queues.ts` + `workers.ts`** — BullMQ connection used invalid `{ connection: { url: '...' } }` format. BullMQ requires an ioredis `Redis` instance. Created shared `queue/connection.ts` with singleton ioredis connection.
- [x] **`package.json` (core)** — Had `redis` package instead of `ioredis`. BullMQ requires ioredis. Swapped dependency.
- [x] **`package.json` (root)** — Workspaces glob `packages/*` wouldn't resolve nested agent/site packages at `packages/agents/*` or `packages/sites/*`. Updated to explicit paths: `packages/core`, `packages/cli`, `packages/agents/*`, `packages/sites/*`.

### Bugs Fixed
- [x] **`router.ts`** — Gemini model was `gemini-2.0-flash-exp` (old). Updated to `gemini-2.5-flash` per spec. Also updated matching key in `cost-tracker.ts` PRICING map.
- [x] **`router.ts`** — Google handler had no-op `model.replace('gemini-', 'gemini-')` and flattened all messages into one string (losing system/user role distinction). Fixed to use Gemini's `systemInstruction` parameter and extract usage metadata for cost tracking.
- [x] **`seed-cities.ts`** — Scottsdale, AZ was listed twice (duplicate entry). Removed duplicate.
- [x] **`seed-niche-config.ts`** — Leading space in search query `' debris disposal {city}'`. Fixed to `'debris disposal {city}'`.
- [x] **`db/client.ts`** — `getSupabaseClient()` silently escalated to service role key when available, making it identical to `getSupabaseAdmin()`. Fixed to always use anon key.

### Design Improvements
- [x] **`router.ts`** — `callAI()` now automatically tracks costs via `trackCost()` (fire-and-forget). Added `nicheId` and `agent` fields to `CallAIOptions` for tracking context. No more manual cost tracking needed per call.
- [x] **`db/client.ts`** — `getSupabaseAdmin()` now caches its client as a singleton (was creating a new client on every call).
- [x] **`providers.ts`** — Replaced `createRequire` hack with proper ESM imports for `@anthropic-ai/sdk` and `@google/generative-ai`. Full type safety restored.
- [x] **`workers.ts`** — `getQueueStats()` now returns real queue counts from BullMQ instead of hardcoded zeros.
- [x] **`queue/connection.ts`** — New shared module. Single ioredis connection used by both queues and workers (eliminates duplicated `getConnectionOptions()`).

### Architecture Notes
- The folder structure layout is correct. Grouping agents under `packages/agents/` and sites under `packages/sites/` is logical. The only issue was the workspaces glob, now fixed.
- All prompts are in a single `prompts/index.ts` file. The spec shows separate files per agent (`discovery.ts`, `verification.ts`, etc.) — consider splitting if the file grows large when adding more prompt variants.

---

## Weekend 1: Foundation

**Goal:** Set up monorepo, database, AI router, and core infrastructure

### 1.1 Initialize Monorepo
- [x] Create `package.json` with npm workspaces configuration (updated: explicit paths for nested packages)
- [x] Create `tsconfig.base.json` with strict TypeScript settings
- [x] Create `.env.example` with all required environment variables (see spec Section 9)
- [x] Create `.gitignore` (node_modules, .env, dist, .turbo)
- [x] Create `docker-compose.yml` for local Redis
- [x] Run `npm install` to verify workspace setup
- [x] Create directory structure: `packages/core`, `packages/agents/*`, `packages/sites`, `packages/cli`, `scripts`
- [x] Install shared dev dependencies: `typescript`, `tsx`, `@types/node`

### 1.2 Set Up Supabase
- [ ] Create Supabase project (free tier)
- [ ] Run `supabase/migrations/001_core_schema.sql`
- [ ] Run `supabase/migrations/002_pipeline_schema.sql`
- [ ] Run `supabase/migrations/003_cost_tracking.sql`
- [ ] Verify all tables created: `cities`, `niches`, `businesses`, `pipeline_jobs`, `approval_queue`, `content`, `ai_usage`
- [ ] Verify all indexes created (check `idx_businesses_niche_city`, `idx_businesses_status`, `idx_ai_usage_niche`, etc.)

### 1.3 Build Core AI Layer
- [x] Build `packages/core/src/ai/providers.ts` — OpenRouter, Anthropic, Google clients (uses proper ESM imports)
  - [x] OpenRouter client with `X-Provider-Allow: 'Fireworks,Together,Novita'` header (US-only inference)
  - [x] Anthropic client for Claude Sonnet (direct, via Pro sub)
  - [x] Google Generative AI client for Gemini Flash (direct, via Pixel sub)
- [x] Build `packages/core/src/ai/router.ts` — task → model routing with MODEL_MAP (auto cost tracking integrated)
- [x] Create `packages/core/src/ai/prompts/index.ts` with prompt templates for all agents:
  - [x] `discoveryPrompts` — search result parsing prompt
  - [x] `verificationPrompts` — business classification prompt (KEEP/REMOVE/UNCERTAIN)
  - [x] `enrichmentPrompts` — description generation, service flags, schema prompts
  - [x] `contentPrompts` — city page + meta generation prompts
  - [x] `nicheResearchPrompts` — niche expansion, scoring prompts
  - [x] `qaPrompts` — description quality judgment
- [ ] Test Gemma 3 via router
- [ ] Test MiniMax M2.5 via router
- [ ] Test GLM-5 via router
- [ ] Test Kimi K2.5 via router
- [ ] Test Devstral via router
- [ ] Test Claude Haiku via router
- [ ] Test Claude Sonnet (direct) via router
- [ ] Test Gemini Flash (direct) via router
- [ ] Verify US-hosted routing works (check response headers or latency from Fireworks)

### 1.4 Build Core Database Layer
- [x] Build `packages/core/src/db/client.ts` — Supabase client singletons (anon + admin, both cached)
- [x] Build `packages/core/src/db/schema.ts` — TypeScript types matching DB tables (Zod schemas for runtime validation)
- [x] Build `packages/core/src/db/queries.ts` — reusable query functions (insert business, update status, fetch by niche/city, cost aggregation, etc.)

### 1.5 Build Core Utilities
- [x] Build `packages/core/src/utils/logger.ts` — structured logging with pino
- [x] Build `packages/core/src/utils/rate-limiter.ts` — per-API rate limiting (Google CSE: 100/day, Places: varies, OpenRouter: per-model)
- [x] Build `packages/core/src/utils/cost-tracker.ts` — track AI spend per agent per niche, writes to `ai_usage` table (auto-called by router)
- [x] Install core dependencies: `@supabase/supabase-js`, `@anthropic-ai/sdk`, `@google/generative-ai`, `bullmq`, `ioredis`, `pino`, `zod`, `fuse.js`

### 1.6 Build Core API Wrappers
- [x] Build `packages/core/src/apis/google-places.ts` — Places API: text search, get details, get reviews
- [x] Build `packages/core/src/apis/google-search.ts` — Custom Search API wrapper with quota tracking
- [ ] Build `packages/core/src/apis/serp.ts` — SerpAPI fallback if CSE quota exceeded

### 1.7 Set Up Redis & Queue Infrastructure
- [x] Build `packages/core/src/queue/connection.ts` — shared ioredis singleton connection
- [x] Build `packages/core/src/queue/queues.ts` — queue definitions per agent (uses shared connection)
- [x] Build `packages/core/src/queue/workers.ts` — worker registration + concurrency config + real `getQueueStats()`
- [ ] Verify BullMQ can connect to Redis (`docker-compose up -d` then test)
- [ ] Set up Bull Board dashboard for queue monitoring (optional but helpful)

### 1.8 Seed Database
- [x] Build `scripts/seed-cities.ts` — load 162 US cities with state, population, lat/lng (expand to 500+ later)
- [ ] Run seed-cities.ts
- [ ] Verify cities table populated
- [x] Build `scripts/seed-niche-config.ts` — 5 niche templates with query templates + service flags
- [ ] Run seed-niche-config.ts

### 1.9 Test Foundation
- [ ] Test: Call each model via router, verify responses return valid text
- [ ] Test: Insert and query a business record in Supabase
- [ ] Test: Enqueue a BullMQ job, process it in a worker, verify completion
- [ ] Test: Cost tracker logs a usage record to `ai_usage` table (should happen automatically via router)
- [ ] Test: Rate limiter correctly throttles when limit exceeded

---

## Weekend 2: Niche Researcher + Discovery

**Goal:** Build first two agents that find and research business opportunities

### 2.1 Build Niche Researcher Agent
- [ ] Create `packages/agents/niche-researcher/package.json`
- [ ] Build `packages/agents/niche-researcher/src/search-strategy.ts` — Google Trends + keyword analysis
- [ ] Build `packages/agents/niche-researcher/src/competitor-scan.ts` — find existing directories, grade quality (coverage, freshness, UX, mobile, SEO)
- [ ] Build `packages/agents/niche-researcher/src/opportunity-score.ts` — multi-factor scoring (1-100): search volume × weak competition × strong monetization
- [ ] Build `packages/agents/niche-researcher/src/report-generator.ts` — human-readable opportunity report
- [ ] Build `packages/agents/niche-researcher/src/index.ts` — agent entry point + BullMQ worker
- [ ] Add `niche_opportunities` table to Supabase (or add to existing migration) for storing research results

### 2.2 Build Discovery Agent
- [ ] Create `packages/agents/discovery/package.json`
- [ ] Build `packages/agents/discovery/src/search-queries.ts` — generate niche-specific search queries (6 queries per city, loaded from niche config)
- [ ] Build `packages/agents/discovery/src/result-parser.ts` — extract business names from search results using Gemma 3
- [ ] Build `packages/agents/discovery/src/deduplicator.ts` — fuzzy match against existing DB entries (fuse.js + optional geocoding distance check)
- [ ] Build `packages/agents/discovery/src/index.ts` — agent entry + BullMQ worker
- [ ] Integrate `packages/core/src/apis/google-search.ts` for CSE calls

### 2.3 Set Up Agent Infrastructure
- [ ] Configure BullMQ queues for niche-researcher
- [ ] Configure BullMQ queues for discovery
- [ ] Add rate limiting for discovery (respect Google CSE quota: 100 free/day)
- [ ] Configure batch size: 20 cities per day at free tier

### 2.4 Test Niche Researcher
- [ ] Test: Run niche research for "mattress recycling"
- [ ] Verify: Opportunity score generated and saved to DB
- [ ] Verify: Competitor analysis found real directories
- [ ] Verify: Monetization estimate included (affiliate programs, ad CPM estimate)
- [ ] Verify: Report is human-readable and actionable

### 2.5 Test Discovery Agent
- [ ] Test: Discover businesses in 5 Ohio cities (Columbus, Cleveland, Cincinnati, Dayton, Toledo)
- [ ] Test: Verify Google CSE returns results for niche queries
- [ ] Verify: Businesses inserted into database with `status: 'discovered'`
- [ ] Verify: Deduplication working (run same city twice, confirm no new duplicates)
- [ ] Verify: Source field set to 'google_search'
- [ ] Verify: Rate limiter prevents exceeding CSE daily quota

---

## Weekend 3: Verification + Enrichment

**Goal:** Build agents that verify businesses and add rich content

### 3.1 Build Verification Agent
- [ ] Create `packages/agents/verification/package.json`
- [ ] Build `packages/agents/verification/src/places-verify.ts` — Google Places API: text search → get place_id → fetch details (name, address, phone, website, hours, rating, reviews)
- [ ] Build `packages/agents/verification/src/review-analyzer.ts` — AI reads reviews for niche relevance (MiniMax M2.5)
- [ ] Build `packages/agents/verification/src/confidence-scorer.ts` — classify KEEP / REMOVE / UNCERTAIN. UNCERTAIN items get second pass with GLM-5 for lowest hallucination.
- [ ] Build `packages/agents/verification/src/index.ts` — agent entry + BullMQ worker
- [ ] Implement Zod validation on AI classification output (models sometimes return malformed JSON)

### 3.2 Build Enrichment Agent
- [ ] Create `packages/agents/enrichment/package.json`
- [ ] Build `packages/agents/enrichment/src/description-gen.ts` — SEO descriptions per business (MiniMax M2.5, batches of 20)
- [ ] Build `packages/agents/enrichment/src/flag-assigner.ts` — boolean service flags from reviews (Gemma 3)
- [ ] Build `packages/agents/enrichment/src/schema-gen.ts` — JSON-LD LocalBusiness structured data (Devstral)
- [ ] Build `packages/agents/enrichment/src/index.ts` — agent entry + BullMQ worker
- [ ] Validate generated JSON-LD against Schema.org spec (basic structure check)

### 3.3 Connect Pipeline
- [ ] Set up BullMQ event: discovery complete → triggers verification queue
- [ ] Set up BullMQ event: verification complete (KEEP businesses) → triggers enrichment queue
- [ ] Set up BullMQ event: verification UNCERTAIN → triggers GLM-5 second pass → still UNCERTAIN → approval_queue
- [ ] Implement retry logic for failed jobs (max 3 retries with exponential backoff)
- [ ] Add concurrency limits per agent (discovery: 5 concurrent, verification: 3, enrichment: 5)
- [ ] Implement dead letter queue for permanently failed jobs

### 3.4 Test Verification + Enrichment
- [ ] Test: End-to-end pipeline for 1 city (Columbus, OH) — discovery → verification → enrichment
- [ ] Verify: Businesses classified KEEP/REMOVE/UNCERTAIN with correct ratios (~50/40/10)
- [ ] Verify: UNCERTAIN items get GLM-5 second pass
- [ ] Verify: Remaining UNCERTAIN items appear in approval_queue with AI recommendation
- [ ] Verify: Enriched businesses have descriptions (non-empty, 2-3 sentences)
- [ ] Verify: Enriched businesses have service_flags (valid JSON, boolean values)
- [ ] Verify: Enriched businesses have schema_json (valid JSON-LD structure)
- [ ] Verify: google_place_id populated for verified businesses
- [ ] Verify: Cost tracker shows per-model spending for this pipeline run

---

## Weekend 4: Content + QA + CLI

**Goal:** Build content generation, quality assurance, and command interface

### 4.1 Build Content Agent
- [ ] Create `packages/agents/content/package.json`
- [ ] Build `packages/agents/content/src/city-page-gen.ts` — unique landing page copy per city (MiniMax M2.5, batch 10 cities)
- [ ] Build `packages/agents/content/src/blog-gen.ts` — long-form blog posts, 1000-1500 words (Claude Sonnet 4.5 via Pro sub, 2-3 per niche)
- [ ] Build `packages/agents/content/src/meta-gen.ts` — title + description tags, batch generation (MiniMax M2.5)
- [ ] Build `packages/agents/content/src/index.ts` — agent entry + BullMQ worker
- [ ] Set up BullMQ trigger: city reaches 5+ verified businesses → content generation

### 4.2 Build QA Agent
- [ ] Create `packages/agents/qa/package.json`
- [ ] Build `packages/agents/qa/src/description-qa.ts` — sample 5%, judge description quality on 1-10 scale (Claude Haiku 4.5)
- [ ] Build `packages/agents/qa/src/data-integrity.ts` — validate phone format, address format, missing required fields
- [ ] Build `packages/agents/qa/src/duplicate-detect.ts` — cross-city fuzzy duplicate detection (same business in nearby cities)
- [ ] Build `packages/agents/qa/src/index.ts` — agent entry + BullMQ worker
- [ ] Set up BullMQ triggers: fires after enrichment batches AND after content batches

### 4.3 Build CLI
- [ ] Create `packages/cli/package.json`
- [ ] Install `commander` dependency
- [ ] Build `packages/cli/src/index.ts` — entry: `swarm <command>`
- [ ] Build `packages/cli/src/commands/niche.ts` — `swarm niche research "idea"` / `swarm niche list` / `swarm niche approve <id>`
- [ ] Build `packages/cli/src/commands/pipeline.ts` — `swarm pipeline start <niche>` / `swarm pipeline status` / `swarm pipeline pause <niche>`
- [ ] Build `packages/cli/src/commands/approve.ts` — `swarm approve --batch` / `swarm approve <id> --keep` / `swarm approve <id> --remove`
- [ ] Build `packages/cli/src/commands/deploy.ts` — `swarm deploy <niche>` / `swarm deploy <niche> --preview`
- [ ] Build `packages/cli/src/commands/report.ts` — `swarm report daily` / `swarm report cost` / `swarm report cost <niche>`
- [ ] Add `bin` field to cli package.json so `swarm` works globally after `npm link`

### 4.4 Build Telegram Bot
- [ ] Install `grammy` dependency
- [ ] Create `packages/cli/src/telegram-bot.ts`
- [ ] Implement `/start`, `/help` commands
- [ ] Implement `/niche <idea>` command — triggers niche research
- [ ] Implement `/pipeline <niche>` command — shows status or starts pipeline
- [ ] Implement `/approve` command — shows pending UNCERTAIN items with inline approve/reject buttons
- [ ] Implement `/report` command — daily summary + cost breakdown
- [ ] Implement inline keyboard callbacks for approval flow (tap to approve/reject from Telegram notification)
- [ ] Set up long-polling for development, webhook for production

### 4.5 Test Content + QA + CLI
- [ ] Test: Generate city page for Columbus, OH — verify unique intro copy, business count, local context
- [ ] Test: Generate 1 blog post on mattress recycling topic — verify 1000+ words, SEO-friendly
- [ ] Test: Generate meta tags for 10 pages — verify title < 60 chars, description < 160 chars
- [ ] Test: Run QA checks on enriched data — verify issues flagged
- [ ] Test: CLI `swarm pipeline status` shows correct state
- [ ] Test: CLI `swarm report cost` shows per-model breakdown
- [ ] Test: Telegram bot `/report` sends formatted summary
- [ ] Test: Telegram bot `/approve` shows inline buttons that work

---

## Weekend 5: Site Template + First Deploy

**Goal:** Build Astro template and deploy first preview site

### 5.1 Build Astro Site Template
- [ ] Create `packages/sites/directory-template/package.json`
- [ ] Create `packages/sites/directory-template/astro.config.mjs` (output: 'static', adapter: none)
- [ ] Build `packages/sites/directory-template/src/layouts/BaseLayout.astro` — head tags, nav, footer, SEO meta
- [ ] Build `packages/sites/directory-template/src/pages/index.astro` — homepage with state list + total business count
- [ ] Build `packages/sites/directory-template/src/pages/[state]/index.astro` — state page with city list
- [ ] Build `packages/sites/directory-template/src/pages/[state]/[city].astro` — city page with business listings
- [ ] Build `packages/sites/directory-template/src/pages/blog/[slug].astro` — blog post pages
- [ ] Build `packages/sites/directory-template/src/components/BusinessCard.astro` — name, address, phone, website, description, service flags
- [ ] Build `packages/sites/directory-template/src/components/CityList.astro` — alphabetical city grid for state pages
- [ ] Build `packages/sites/directory-template/src/components/SearchBar.astro` — client-side search/filter for city pages
- [ ] Build `packages/sites/directory-template/src/styles/global.css`
- [ ] Add `sitemap.xml` generation (Astro sitemap integration)
- [ ] Add `robots.txt` (allow all, reference sitemap)
- [ ] Add `ads.txt` placeholder (needed for future ad network approval)
- [ ] Inject JSON-LD structured data from `schema_json` field into each business card

### 5.2 Connect Astro to Supabase
- [ ] Add Supabase client to Astro (build-time only, no runtime)
- [ ] Query businesses by niche at build time (WHERE niche_id = X AND status = 'enriched')
- [ ] Query content (city pages, blog posts) at build time
- [ ] Implement getStaticPaths for `[state]/[city]` dynamic routes
- [ ] Implement getStaticPaths for `blog/[slug]` dynamic routes
- [ ] Handle empty states (city with 0 businesses → skip page generation)
- [ ] Pass niche display_name and config to templates for parameterized branding

### 5.3 Build Deploy System
- [ ] Build deploy script: queries Supabase → builds Astro → deploys to Vercel
- [ ] Parameterize deploy script to accept niche_id (builds correct data for that niche)
- [ ] Set up Vercel project for directory-template
- [ ] Configure Vercel environment variables (SUPABASE_URL, SUPABASE_ANON_KEY, NICHE_ID)
- [ ] Implement preview deployments (`swarm deploy <niche> --preview`)
- [ ] Implement production deployments (`swarm deploy <niche> --production`)

### 5.4 Set Up Production Hosting (Agents)
- [ ] Provision $6/mo DigitalOcean droplet (1 vCPU, 2GB RAM)
- [ ] Install Node.js (v22 LTS), Redis, PM2
- [ ] Clone repo, install dependencies, build TypeScript
- [ ] Set up PM2 ecosystem.config.js for all agent workers + supervisor
- [ ] Configure UFW firewall (allow SSH only, agents don't need open ports)
- [ ] Set up monitoring — UptimeRobot for Telegram bot webhook (optional)
- [ ] Set up GitHub Actions: push to main → SSH deploy to droplet (optional but recommended)

### 5.5 Test Deploy
- [ ] Test: Deploy mattress-recycling preview to Vercel
- [ ] Verify: Astro build succeeds with no errors
- [ ] Verify: Homepage renders with correct niche name and total business count
- [ ] Verify: State pages list correct cities
- [ ] Verify: City pages show business cards with descriptions
- [ ] Verify: Business cards include phone, address, website links
- [ ] Verify: JSON-LD structured data present in page source
- [ ] Verify: Blog posts render with correct content
- [ ] Verify: sitemap.xml generated and valid
- [ ] Verify: Mobile responsive (test on phone)
- [ ] Lighthouse audit: check SEO score, performance, accessibility

---

## Weekend 6: Scale + Polish

**Goal:** Run full pipeline, optimize, and go live

### 6.1 Run Full Pipeline
- [ ] Start pipeline for all 500 cities × mattress recycling niche
- [ ] Monitor discovery progress daily (via `/report` Telegram command)
- [ ] Monitor verification queue for stuck jobs
- [ ] Handle rate limiting (Google CSE 100/day free — expect ~25 days for 500 cities)
- [ ] Review UNCERTAIN items daily (~5 min/day via Telegram inline buttons)

### 6.2 Monitor & Tune
- [ ] Monitor costs via `ai_usage` table — run `swarm report cost mattress-recycling`
- [ ] Compare actual costs to spec estimates ($17-31 total)
- [ ] Review AI prompt quality — spot-check 10 descriptions, 5 city pages
- [ ] Tune prompts for better quality + efficiency (reduce token waste)
- [ ] Fix any data integrity issues flagged by QA agent
- [ ] Resolve duplicate detection flags
- [ ] Check for common failure modes: malformed JSON, empty responses, rate limit errors

### 6.3 Deploy to Production
- [ ] Purchase domain (e.g., mattressrecycling.directory or recyclemymattress.com)
- [ ] Configure DNS for Vercel (CNAME or A record)
- [ ] Deploy to production via `swarm deploy mattress-recycling --production`
- [ ] Verify production site works on custom domain
- [ ] Submit sitemap to Google Search Console
- [ ] Set up Google Analytics (or Plausible for privacy-friendly alternative)

### 6.4 Set Up Monetization
- [ ] Apply for Google AdSense (or Ezoic/Mediavine — check minimum traffic requirements)
- [ ] Research niche-specific affiliate programs (e.g., mattress brands, recycling services)
- [ ] Add ad placement components to Astro template
- [ ] Update ads.txt with approved ad network info
- [ ] Add affiliate links where appropriate (follow FTC disclosure requirements)

### 6.5 Build Supervisor Features
- [ ] Implement daily status report → Telegram (Gemini Flash): "Today: 47 verified, 3 need review, Directory #1 at 78%"
- [ ] Implement cost report → Telegram: per-model, per-niche breakdown
- [ ] Implement anomaly detection (Claude Haiku): flag cost spikes > 2x daily average, quality drops, stuck queues
- [ ] Implement natural language command parsing (Gemini Flash): "start electronics recycling in California" → pipeline commands

### 6.6 Start Next Niches
- [ ] Brainstorm 20-50 niche ideas
- [ ] Run batch niche research: `swarm niche research --file ideas.txt`
- [ ] Review top 10 scored niches
- [ ] Approve and start pipeline for niche #2
- [ ] Approve and start pipeline for niche #3 (can run parallel with #2 since different BullMQ queues)

---

## Post-Build: Daily Routine (~15 min/day)

1. [ ] Check Telegram for overnight summary
2. [ ] Review 5-10 UNCERTAIN businesses in approval queue (inline buttons)
3. [ ] Approve/reject via Telegram
4. [ ] Check for QA flags or anomaly alerts
5. [ ] Glance at cost report weekly
6. [ ] Iterate on prompts as needed based on QA feedback

---

## Milestones

- [ ] **Milestone 1:** Weekend 1 — Foundation complete. All models callable. DB seeded. BullMQ working.
- [ ] **Milestone 2:** Weekend 2 — Can research a niche and discover businesses in 5 cities.
- [ ] **Milestone 3:** Weekend 3 — End-to-end pipeline works for 1 city (discovery → verification → enrichment).
- [ ] **Milestone 4:** Weekend 4 — CLI + Telegram bot working. Can approve items remotely.
- [ ] **Milestone 5:** Weekend 5 — First Vercel preview live with real data.
- [ ] **Milestone 6:** Weekend 6 — First directory LIVE on production domain. Second niche in pipeline.

---

## Risk Checklist

- [ ] **Google CSE free tier exhaustion** — Have SerpAPI fallback ready. Or budget $5 for 1000 extra queries.
- [ ] **Google Places API cost** — Monitor closely. First $200/mo free. Text search = $32/1000 requests. Plan for ~2500 lookups per niche.
- [ ] **AI model returns malformed JSON** — Zod validation on all AI outputs. Retry with stricter prompt on failure.
- [ ] **MiniMax M2.5 is brand new (Feb 2026)** — Have DeepSeek V3.2 as fallback in MODEL_MAP. Can swap with one line change.
- [ ] **OpenRouter outage** — Direct API fallbacks for critical models (Claude via Anthropic, Gemini via Google).
- [ ] **Supabase free tier limits** — 500MB storage, 2GB bandwidth. Monitor with `SELECT pg_database_size('postgres')`.
- [ ] **Vercel deploy rate limits** — 100 deploys/day on free tier. Deploy only when content changes, not on every pipeline run.
