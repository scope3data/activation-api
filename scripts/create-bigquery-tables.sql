-- BigQuery table creation scripts for Scope3 Campaign API
-- Dataset: bok-playground.agenticapi
-- Location: us-central1

-- 1. Brand Agent Extensions
-- Extends the existing swift-catfish-337215.postgres_datastream.public_agent table
CREATE TABLE IF NOT EXISTS `bok-playground.agenticapi.brand_agent_extensions` (
  agent_id STRING NOT NULL,
  advertiser_domains ARRAY<STRING>,
  dsp_seats ARRAY<STRING>,
  description STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_at)
CLUSTER BY agent_id;

-- 2. Campaigns
CREATE TABLE IF NOT EXISTS `bok-playground.agenticapi.campaigns` (
  id STRING NOT NULL,
  brand_agent_id STRING NOT NULL,
  name STRING NOT NULL,
  prompt STRING,
  status STRING DEFAULT 'draft',
  budget_total FLOAT64,
  budget_currency STRING DEFAULT 'USD',
  budget_daily_cap FLOAT64,
  budget_pacing STRING DEFAULT 'even',
  scoring_weights JSON,
  outcome_score_window_days INT64 DEFAULT 7,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_at)
CLUSTER BY brand_agent_id, status;

-- 3. Creatives
CREATE TABLE IF NOT EXISTS `bok-playground.agenticapi.creatives` (
  id STRING NOT NULL,
  brand_agent_id STRING NOT NULL,
  name STRING NOT NULL,
  description STRING,
  format_type STRING,
  format_id STRING,
  content JSON,
  status STRING DEFAULT 'draft',
  version STRING DEFAULT '1.0.0',
  assembly_method STRING DEFAULT 'pre_assembled',
  target_audience JSON,
  content_categories ARRAY<STRING>,
  created_by STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_at)
CLUSTER BY brand_agent_id, status;

-- 4. Campaign-Creative Assignment Mapping
CREATE TABLE IF NOT EXISTS `bok-playground.agenticapi.campaign_creatives` (
  campaign_id STRING NOT NULL,
  creative_id STRING NOT NULL,
  status STRING DEFAULT 'active',
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  assigned_by STRING
)
CLUSTER BY campaign_id, creative_id;

-- 5. Campaign-Brand Story Assignment Mapping
CREATE TABLE IF NOT EXISTS `bok-playground.agenticapi.campaign_brand_stories` (
  campaign_id STRING NOT NULL,
  brand_story_id STRING NOT NULL,
  weight FLOAT64 DEFAULT 1.0,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY campaign_id, brand_story_id;

-- Indexes and constraints (BigQuery-style)
-- Note: BigQuery uses clustering and partitioning instead of traditional indexes

-- Primary key constraints are enforced at application level
-- since BigQuery doesn't support traditional primary keys