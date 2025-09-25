-- BigQuery Migration Script for Existing Tables
-- This script handles adding columns to existing tables with proper BigQuery syntax
-- Run these commands separately if tables already exist

-- Step 1: Add customer_id to campaigns table (if not exists)
ALTER TABLE `bok-playground.agenticapi.campaigns`
ADD COLUMN IF NOT EXISTS customer_id INT64;

-- Step 2: Set default value for customer_id in campaigns
UPDATE `bok-playground.agenticapi.campaigns` 
SET customer_id = 1 
WHERE customer_id IS NULL;

-- Step 3: Add customer_id to creatives table (if not exists)
ALTER TABLE `bok-playground.agenticapi.creatives`
ADD COLUMN IF NOT EXISTS customer_id INT64;

-- Step 4: Set default value for customer_id in creatives
UPDATE `bok-playground.agenticapi.creatives` 
SET customer_id = 1 
WHERE customer_id IS NULL;

-- Step 5: Add org_id to sales_agents table (if not exists)
ALTER TABLE `bok-playground.agenticapi.sales_agents`
ADD COLUMN IF NOT EXISTS org_id STRING;

-- Step 6: Add tactic_seed_data_coop to brand_agent_extensions table (if not exists)
ALTER TABLE `bok-playground.agenticapi.brand_agent_extensions`
ADD COLUMN IF NOT EXISTS tactic_seed_data_coop BOOLEAN;

-- Step 7: Set default value for tactic_seed_data_coop
UPDATE `bok-playground.agenticapi.brand_agent_extensions` 
SET tactic_seed_data_coop = FALSE 
WHERE tactic_seed_data_coop IS NULL;