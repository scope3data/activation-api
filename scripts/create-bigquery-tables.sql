-- BigQuery table creation scripts for Scope3 Campaign API
-- Dataset: bok-playground.agenticapi
-- Location: us-central1

-- 1. Brand Agent Extensions
-- Extends the existing swift-catfish-337215.postgres_datastream.public_agent table
CREATE TABLE IF NOT EXISTS `bok-playground.agenticapi.brand_agent_extensions` (
  agent_id INT64 NOT NULL,
  advertiser_domains ARRAY<STRING>,
  dsp_seats ARRAY<STRING>,
  description STRING,
  external_id STRING, -- Customer-scoped external identifier
  nickname STRING, -- Customer-scoped friendly name
  tactic_seed_data_coop BOOLEAN DEFAULT FALSE, -- Opt-in to tactic seed data cooperative
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_at)
CLUSTER BY agent_id;

-- 2. Campaigns
CREATE TABLE IF NOT EXISTS `bok-playground.agenticapi.campaigns` (
  id STRING NOT NULL,
  brand_agent_id INT64 NOT NULL,
  customer_id INT64 NOT NULL,
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
CLUSTER BY brand_agent_id, customer_id, status;

-- 3. Creatives
CREATE TABLE IF NOT EXISTS `bok-playground.agenticapi.creatives` (
  id STRING NOT NULL,
  brand_agent_id INT64 NOT NULL,
  customer_id INT64 NOT NULL,
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
CLUSTER BY brand_agent_id, customer_id, status;

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

-- 6. Signals Agents (registered agents that can manage segments)
CREATE TABLE IF NOT EXISTS `bok-playground.agenticapi.signals_agents` (
  id STRING NOT NULL,
  brand_agent_id INT64 NOT NULL,
  name STRING NOT NULL,
  description STRING,
  endpoint_url STRING NOT NULL,
  api_key STRING,
  status STRING DEFAULT 'active',
  config JSON,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  registered_by STRING,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(registered_at)
CLUSTER BY brand_agent_id, status;

-- 7. Signals Agent Activity (audit log of all agent actions)
CREATE TABLE IF NOT EXISTS `bok-playground.agenticapi.signals_agent_activity` (
  id STRING NOT NULL,
  signals_agent_id STRING NOT NULL,
  brand_agent_id INT64 NOT NULL,
  activity_type STRING NOT NULL,
  request JSON,
  response JSON,
  segment_ids ARRAY<STRING>,
  status STRING,
  response_time_ms INT64,
  error_details STRING,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(executed_at)
CLUSTER BY signals_agent_id, activity_type;

-- Migration: Add customer_id columns to existing tables
-- Run these if the tables already exist without the new columns:

-- Add customer_id to campaigns table
ALTER TABLE `bok-playground.agenticapi.campaigns`
ADD COLUMN IF NOT EXISTS customer_id INT64 DEFAULT 1;

-- Add customer_id to creatives table  
ALTER TABLE `bok-playground.agenticapi.creatives`
ADD COLUMN IF NOT EXISTS customer_id INT64 DEFAULT 1;

-- Migration: Add tactic_seed_data_coop column to existing brand_agent_extensions table
-- Run this if the table already exists without the new column:
-- ALTER TABLE `bok-playground.agenticapi.brand_agent_extensions`
-- ADD COLUMN IF NOT EXISTS tactic_seed_data_coop BOOLEAN DEFAULT FALSE;

-- Migration: Add agent tracking columns to custom signals tables
-- These will be handled in the custom signals dataset, not here
-- The signal-storage-service.ts will need to be updated to support agent tracking