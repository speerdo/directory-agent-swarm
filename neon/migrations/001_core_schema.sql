-- Core Schema for Directory Swarm
-- Run this first: 001_core_schema.sql

-- Cities table
CREATE TABLE IF NOT EXISTS cities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  state_code CHAR(2) NOT NULL,
  state_name TEXT NOT NULL,
  population INT,
  lat DECIMAL(9,6),
  lng DECIMAL(9,6),
  UNIQUE(name, state_code)
);

CREATE INDEX IF NOT EXISTS idx_cities_state ON cities(state_code);
CREATE INDEX IF NOT EXISTS idx_cities_population ON cities(population DESC);

-- Niches table
CREATE TABLE IF NOT EXISTS niches (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  domain TEXT,
  status TEXT DEFAULT 'researching' CHECK (status IN ('researching', 'approved', 'building', 'live')),
  config JSONB DEFAULT '{}',
  opportunity_score INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_niches_status ON niches(status);
CREATE INDEX IF NOT EXISTS idx_niches_opportunity ON niches(opportunity_score DESC);

-- Businesses table
CREATE TABLE IF NOT EXISTS businesses (
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
);

CREATE INDEX IF NOT EXISTS idx_businesses_niche_city ON businesses(niche_id, city_id);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_place_id ON businesses(google_place_id);
CREATE INDEX IF NOT EXISTS idx_businesses_niche_status ON businesses(niche_id, status);
