import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DB_CONNECTION_STRING);

const statements = [
  `CREATE INDEX IF NOT EXISTS idx_cities_state ON cities(state_code);`,
  `CREATE INDEX IF NOT EXISTS idx_cities_population ON cities(population DESC);`,
  `CREATE TABLE IF NOT EXISTS niches (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    domain TEXT,
    status TEXT DEFAULT 'researching' CHECK (status IN ('researching', 'approved', 'building', 'live')),
    config JSONB DEFAULT '{}',
    opportunity_score INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_niches_status ON niches(status);`,
  `CREATE INDEX IF NOT EXISTS idx_niches_opportunity ON niches(opportunity_score DESC);`,
  `CREATE TABLE IF NOT EXISTS businesses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    niche_id TEXT REFERENCES niches(id) ON DELETE CASCADE,
    city_id INT REFERENCES cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    website TEXT,
    google_place_id TEXT,
    lat DECIMAL(9,6),
    lng DECIMAL(9,6),
    status TEXT DEFAULT 'discovered' CHECK (status IN ('discovered', 'verified', 'enriched', 'live', 'removed')),
    confidence DECIMAL(3,2),
    description TEXT,
    service_flags JSONB DEFAULT '{}',
    schema_json JSONB,
    source TEXT,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    enriched_at TIMESTAMPTZ
  );`,
  `CREATE INDEX IF NOT EXISTS idx_businesses_niche_city ON businesses(niche_id, city_id);`,
  `CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);`,
  `CREATE INDEX IF NOT EXISTS idx_businesses_place_id ON businesses(google_place_id);`,
  `CREATE INDEX IF NOT EXISTS idx_businesses_niche_status ON businesses(niche_id, status);`,
  `CREATE TABLE IF NOT EXISTS pipeline_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    niche_id TEXT REFERENCES niches(id) ON DELETE CASCADE,
    agent TEXT NOT NULL,
    city_id INT REFERENCES cities(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'paused')),
    input JSONB DEFAULT '{}',
    output JSONB DEFAULT '{}',
    error TEXT,
    attempts INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_pipeline_niche_agent ON pipeline_jobs(niche_id, agent, status);`,
  `CREATE INDEX IF NOT EXISTS idx_pipeline_status ON pipeline_jobs(status);`,
  `CREATE TABLE IF NOT EXISTS approval_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    agent TEXT NOT NULL,
    reason TEXT,
    ai_recommendation TEXT,
    confidence DECIMAL(3,2),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_at TIMESTAMPTZ
  );`,
  `CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON approval_queue(status);`,
  `CREATE TABLE IF NOT EXISTS content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    niche_id TEXT REFERENCES niches(id) ON DELETE CASCADE,
    city_id INT REFERENCES cities(id) ON DELETE SET NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('city_page', 'blog_post', 'meta_description')),
    title TEXT,
    body TEXT,
    meta_title TEXT,
    meta_description TEXT,
    slug TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_content_niche ON content(niche_id);`,
  `CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type);`,
  `CREATE INDEX IF NOT EXISTS idx_content_slug ON content(slug);`,
  `CREATE INDEX IF NOT EXISTS idx_content_niche_type ON content(niche_id, content_type);`,
  `CREATE TABLE IF NOT EXISTS ai_usage (
    id SERIAL PRIMARY KEY,
    task_type TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INT,
    output_tokens INT,
    cost_usd DECIMAL(8,6),
    latency_ms INT,
    niche_id TEXT REFERENCES niches(id) ON DELETE SET NULL,
    agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_ai_usage_niche ON ai_usage(niche_id, created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage(model, created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage(created_at);`
];

async function main() {
  let completed = 0;
  for (const statement of statements) {
    await sql.query(statement);
    completed++;
    console.log(completed + '/' + statements.length + ' done');
  }
  console.log('All tables created!');
}

main().catch(console.error);
