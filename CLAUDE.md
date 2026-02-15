# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Directory Swarm** — An AI agent system that discovers profitable directory niches, finds businesses across 500+ US cities, verifies them via Google Places API, enriches with AI-generated content, and deploys SEO-optimized Astro static sites to Vercel.

This is a monorepo using npm workspaces. The codebase has not been built yet — this file guides future implementation.

---

## Common Commands

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run type checking
npm run typecheck

# Run CLI
npx swarm --help

# Run specific commands
npx swarm niche research "mattress recycling"
npx swarm pipeline start <niche>
npx swarm approve --batch
npx swarm deploy <niche>

# Start local Redis (required for BullMQ)
docker-compose up -d

# Run database migrations
psql $SUPABASE_URL -f supabase/migrations/001_core_schema.sql
psql $SUPABASE_URL -f supabase/migrations/002_pipeline_schema.sql
psql $SUPABASE_URL -f supabase/migrations/003_cost_tracking.sql

# Seed database
npx tsx scripts/seed-cities.ts
npx tsx scripts/seed-niche-config.ts

# Run a single agent for testing
npx tsx packages/agents/discovery/src/index.ts
```

---

## Architecture

### Monorepo Structure

```
packages/
├── core/           # Shared: AI router, DB client, APIs, queue, utils
├── agents/         # 7 agents: niche-researcher, discovery, verification, enrichment, content, qa, supervisor
├── sites/          # Astro SSG template (parameterized)
└── cli/            # Commander.js CLI + Telegram bot
```

### Agent Communication

Agents communicate via **database state + BullMQ events** — no direct calls:

1. Discovery writes businesses → triggers BullMQ event
2. Verification picks up → writes verified/removed
3. Enrichment picks up → adds descriptions + schema
4. Content generates city pages + blog posts
5. QA spot-checks output

### AI Routing

All AI calls go through `packages/core/src/ai/router.ts`:

| Task | Model | Provider |
|------|-------|----------|
| extract_names, classify_boolean | Gemma 3 27B | OpenRouter |
| verify_business, generate_description, generate_city_page | MiniMax M2.5 | OpenRouter |
| uncertain_judgment, niche_research | GLM-5 | OpenRouter |
| generate_schema | Devstral Small | OpenRouter |
| qa_judge | Claude Haiku 4.5 | OpenRouter |
| generate_blog | Claude Sonnet 4.5 | Anthropic (Pro sub) |
| summarize_status, parse_command | Gemini 2.5 Flash | Google (Pixel sub) |

### Database

Supabase (PostgreSQL) with these core tables:
- `cities` — 500+ US cities with lat/lng
- `niches` — directory configurations
- `businesses` — listings with status pipeline
- `pipeline_jobs` — BullMQ job tracking
- `approval_queue` — UNCERTAIN items for human review
- `content` — city pages, blog posts, meta tags
- `ai_usage` — cost tracking per model

### Queue System

BullMQ with Redis for job scheduling, retries, rate limiting, and concurrency.

---

## Environment Variables

Required in `.env`:
- `OPENROUTER_API_KEY` — AI models (except Google/Anthropic)
- `ANTHROPIC_API_KEY` — Claude Sonnet (Pro sub)
- `GOOGLE_AI_API_KEY` — Gemini Flash
- `GOOGLE_PLACES_API_KEY` — Business verification
- `GOOGLE_CSE_ID`, `GOOGLE_CSE_API_KEY` — Business discovery
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL` — BullMQ backend
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — Notifications
- `VERCEL_TOKEN`, `VERCEL_ORG_ID` — Site deployment

---

## Key Design Decisions

- **Astro SSG** for sites (static = free hosting, better SEO)
- **Custom AI router** over LangChain (no framework lock-in)
- **MiniMax M2.5** as workhorse (76.8% BFCL tool calling, $0.15/M input)
- **GLM-5** for reasoning (lowest hallucination — knows when to say "I don't know")
- **US-hosted inference** via OpenRouter `X-Provider-Allow: Fireworks,Together,Novita` for Chinese models

---

## Pipeline Flow

1. **Niche Researcher** — scores profitable niches
2. **Supervisor** — creates pipeline, triggers agents
3. **Discovery** — searches 500 cities × 6 queries
4. **Verification** — Places API + AI classification
5. **Enrichment** — descriptions, flags, Schema.org
6. **Content** — city pages, blog posts, meta tags
7. **QA** — spot-checks, data integrity
8. **Deploy** — Astro build → Vercel preview → production

Human approval required at: niche selection, domain purchase, UNCERTAIN review, preview approval.
