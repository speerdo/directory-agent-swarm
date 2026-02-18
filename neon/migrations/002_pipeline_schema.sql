-- Pipeline Schema for Directory Swarm
-- Run this second: 002_pipeline_schema.sql

-- Pipeline Jobs table
CREATE TABLE IF NOT EXISTS pipeline_jobs (
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
);

CREATE INDEX IF NOT EXISTS idx_pipeline_niche_agent ON pipeline_jobs(niche_id, agent, status);
CREATE INDEX IF NOT EXISTS idx_pipeline_status ON pipeline_jobs(status);

-- Approval Queue table
CREATE TABLE IF NOT EXISTS approval_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  reason TEXT,
  ai_recommendation TEXT,
  confidence DECIMAL(3,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON approval_queue(status);

-- Content table
CREATE TABLE IF NOT EXISTS content (
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
);

CREATE INDEX IF NOT EXISTS idx_content_niche ON content(niche_id);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type);
CREATE INDEX IF NOT EXISTS idx_content_slug ON content(slug);
CREATE INDEX IF NOT EXISTS idx_content_niche_type ON content(niche_id, content_type);
