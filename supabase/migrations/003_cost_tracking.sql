-- Cost Tracking Schema for Directory Swarm
-- Run this third: 003_cost_tracking.sql

-- AI Usage table
CREATE TABLE IF NOT EXISTS ai_usage (
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
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_niche ON ai_usage(niche_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage(model, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage(created_at);

-- Function to estimate current month's AI spend
CREATE OR REPLACE FUNCTION get_monthly_ai_spend()
RETURNS TABLE(
  model TEXT,
  total_cost DECIMAL(10,6),
  total_input_tokens BIGINT,
  total_output_tokens BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai_usage.model,
    SUM(ai_usage.cost_usd)::DECIMAL(10,6) AS total_cost,
    SUM(ai_usage.input_tokens)::BIGINT AS total_input_tokens,
    SUM(ai_usage.output_tokens)::BIGINT AS total_output_tokens
  FROM ai_usage
  WHERE ai_usage.created_at >= date_trunc('month', CURRENT_DATE)
  GROUP BY ai_usage.model
  ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get spend by niche
CREATE OR REPLACE FUNCTION get_niche_spend(p_niche_id TEXT)
RETURNS TABLE(
  agent TEXT,
  task_type TEXT,
  model TEXT,
  total_cost DECIMAL(10,6),
  total_calls INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai_usage.agent,
    ai_usage.task_type,
    ai_usage.model,
    SUM(ai_usage.cost_usd)::DECIMAL(10,6) AS total_cost,
    COUNT(*)::INT AS total_calls
  FROM ai_usage
  WHERE ai_usage.niche_id = p_niche_id
  GROUP BY ai_usage.agent, ai_usage.task_type, ai_usage.model
  ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql;
