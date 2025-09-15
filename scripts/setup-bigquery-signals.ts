#!/usr/bin/env tsx

import { BigQuery } from "@google-cloud/bigquery";

/**
 * Script to set up BigQuery dataset and tables for Custom Signals
 *
 * Usage:
 * npm run setup-bigquery-signals
 * or
 * tsx scripts/setup-bigquery-signals.ts
 */

const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID || "bok-playground";
const DATASET_ID = process.env.BIGQUERY_SIGNALS_DATASET || "custom_signals";
const LOCATION = process.env.BIGQUERY_LOCATION || "US";

async function setupBigQuerySignals() {
  console.log("🔧 Setting up BigQuery Custom Signals infrastructure...");
  console.log(`📍 Project: ${PROJECT_ID}`);
  console.log(`📍 Dataset: ${DATASET_ID}`);
  console.log(`📍 Location: ${LOCATION}\n`);

  const bigquery = new BigQuery({ projectId: PROJECT_ID });

  try {
    // Create dataset if it doesn't exist
    console.log("📦 Creating dataset if needed...");
    const dataset = bigquery.dataset(DATASET_ID);
    const [datasetExists] = await dataset.exists();

    if (!datasetExists) {
      await dataset.create({
        description:
          "Custom Signals Platform - Signal definitions and metadata",
        location: LOCATION,
      });
      console.log(`✅ Created dataset: ${DATASET_ID}`);
    } else {
      console.log(`✅ Dataset already exists: ${DATASET_ID}`);
    }

    // Create signal_definitions table
    console.log("\n📋 Creating signal_definitions table...");
    const definitionsTable = dataset.table("signal_definitions");
    const [defTableExists] = await definitionsTable.exists();

    if (!defTableExists) {
      const definitionsSchema = [
        { mode: "REQUIRED", name: "signal_id", type: "STRING" },
        { mode: "REQUIRED", name: "name", type: "STRING" },
        { mode: "NULLABLE", name: "description", type: "STRING" },
        { mode: "REQUIRED", name: "key_type", type: "STRING" },
        { mode: "REQUIRED", name: "customer_id", type: "INTEGER" },
        { mode: "REQUIRED", name: "created_at", type: "TIMESTAMP" },
        { mode: "NULLABLE", name: "updated_at", type: "TIMESTAMP" },
        { mode: "NULLABLE", name: "created_by", type: "STRING" },
        { mode: "REQUIRED", name: "is_active", type: "BOOLEAN" },
        { mode: "NULLABLE", name: "metadata", type: "JSON" },
      ];

      await definitionsTable.create({
        clustering: {
          fields: ["customer_id", "signal_id", "key_type"],
        },
        description:
          "Custom signal definitions with metadata and key type specifications",
        schema: definitionsSchema,
        timePartitioning: {
          field: "created_at",
          type: "DAY",
        },
      });
      console.log("✅ Created signal_definitions table");
    } else {
      console.log("✅ signal_definitions table already exists");
    }

    // Create signal_clusters table
    console.log("\n🌍 Creating signal_clusters table...");
    const clustersTable = dataset.table("signal_clusters");
    const [clustersTableExists] = await clustersTable.exists();

    if (!clustersTableExists) {
      const clustersSchema = [
        { mode: "REQUIRED", name: "cluster_id", type: "STRING" },
        { mode: "REQUIRED", name: "signal_id", type: "STRING" },
        { mode: "REQUIRED", name: "region", type: "STRING" },
        { mode: "NULLABLE", name: "channel", type: "STRING" },
        { mode: "REQUIRED", name: "gdpr_compliant", type: "BOOLEAN" },
        { mode: "REQUIRED", name: "created_at", type: "TIMESTAMP" },
        { mode: "REQUIRED", name: "is_active", type: "BOOLEAN" },
      ];

      await clustersTable.create({
        clustering: {
          fields: ["signal_id", "region"],
        },
        description:
          "Regional cluster configurations for signal data residency and GDPR compliance",
        schema: clustersSchema,
        timePartitioning: {
          field: "created_at",
          type: "DAY",
        },
      });
      console.log("✅ Created signal_clusters table");
    } else {
      console.log("✅ signal_clusters table already exists");
    }

    // Create signal_data table (for future signal data storage)
    console.log("\n💾 Creating signal_data table...");
    const dataTable = dataset.table("signal_data");
    const [dataTableExists] = await dataTable.exists();

    if (!dataTableExists) {
      const dataSchema = [
        { mode: "REQUIRED", name: "signal_id", type: "STRING" },
        { mode: "REQUIRED", name: "identifier_key", type: "STRING" },
        { mode: "REPEATED", name: "signal_values", type: "STRING" },
        { mode: "NULLABLE", name: "ttl_seconds", type: "INTEGER" },
        { mode: "REQUIRED", name: "created_at", type: "TIMESTAMP" },
        { mode: "REQUIRED", name: "updated_at", type: "TIMESTAMP" },
        { mode: "REQUIRED", name: "expires_at", type: "TIMESTAMP" },
      ];

      await dataTable.create({
        clustering: {
          fields: ["signal_id", "identifier_key"],
        },
        description:
          "Actual signal data storage with TTL and expiration management",
        schema: dataSchema,
        timePartitioning: {
          field: "expires_at",
          type: "DAY",
        },
      });
      console.log("✅ Created signal_data table");
    } else {
      console.log("✅ signal_data table already exists");
    }

    // Create views for common queries
    console.log("\n👁️ Creating utility views...");

    // Active signals view
    const activeSignalsView = dataset.table("active_signals_view");
    const [activeViewExists] = await activeSignalsView.exists();

    if (!activeViewExists) {
      const activeSignalsQuery = `
        SELECT 
          d.signal_id,
          d.name,
          d.description,
          d.key_type,
          d.created_at,
          d.updated_at,
          d.created_by,
          ARRAY_AGG(
            STRUCT(
              c.cluster_id,
              c.region,
              c.channel,
              c.gdpr_compliant
            )
          ) as clusters,
          ANY_VALUE(d.metadata) as metadata
        FROM \`${PROJECT_ID}.${DATASET_ID}.signal_definitions\` d
        LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.signal_clusters\` c
          ON d.signal_id = c.signal_id AND c.is_active = true
        WHERE d.is_active = true
        GROUP BY d.signal_id, d.name, d.description, d.key_type, d.created_at, d.updated_at, d.created_by
        ORDER BY d.created_at DESC
      `;

      await activeSignalsView.create({
        description:
          "View of all active signal definitions with their cluster configurations",
        view: {
          query: activeSignalsQuery,
          useLegacySql: false,
        },
      });
      console.log("✅ Created active_signals_view");
    } else {
      console.log("✅ active_signals_view already exists");
    }

    // Test connectivity
    console.log("\n🔍 Testing connectivity...");
    const testQuery = `
      SELECT COUNT(*) as table_count
      FROM \`${PROJECT_ID}.${DATASET_ID}.INFORMATION_SCHEMA.TABLES\`
      WHERE table_name IN ('signal_definitions', 'signal_clusters', 'signal_data')
    `;

    const [rows] = await bigquery.query({ query: testQuery });
    const tableCount = rows[0]?.table_count || 0;

    if (tableCount >= 3) {
      console.log("✅ All tables are accessible");
    } else {
      console.warn(`⚠️ Only ${tableCount}/3 tables found`);
    }

    console.log("\n🎉 BigQuery Custom Signals setup complete!");
    console.log("\n📊 Summary:");
    console.log(`• Dataset: ${PROJECT_ID}.${DATASET_ID}`);
    console.log("• Tables: signal_definitions, signal_clusters, signal_data");
    console.log("• Views: active_signals_view");
    console.log("• Partitioning: Time-based for optimal performance");
    console.log("• Clustering: Optimized for signal lookups");
    console.log("\n🔧 Next steps:");
    console.log("1. Update environment variables:");
    console.log(`   BIGQUERY_PROJECT_ID=${PROJECT_ID}`);
    console.log(`   BIGQUERY_SIGNALS_DATASET=${DATASET_ID}`);
    console.log("2. Run signal tools to test the integration");
    console.log("3. Upload signal data via the Custom Signals API");
  } catch (error) {
    console.error("❌ Failed to set up BigQuery Custom Signals:");
    console.error(error);
    process.exit(1);
  }
}

// Run the setup
if (import.meta.url === `file://${process.argv[1]}`) {
  setupBigQuerySignals().catch((error) => {
    console.error("Setup failed:", error);
    process.exit(1);
  });
}

export { setupBigQuerySignals };
