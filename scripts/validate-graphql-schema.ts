#!/usr/bin/env tsx

/**
 * GraphQL Schema Validation Script
 *
 * This script validates that all GraphQL queries and mutations in the client
 * are compatible with the actual backend schema. It's designed to be run in
 * CI/CD pipelines to catch schema mismatches before deployment.
 *
 * Usage:
 *   npm run validate-schema
 *   tsx scripts/validate-graphql-schema.ts
 *   tsx scripts/validate-graphql-schema.ts --fix-mode (updates client queries)
 *
 * Exit Codes:
 *   0 - All validations passed
 *   1 - Schema validation failures found
 *   2 - Configuration or file errors
 */

import { existsSync, readFileSync } from "fs";
import { glob } from "glob";
import { buildSchema, GraphQLError, parse, validate } from "graphql";
import { join } from "path";

interface SchemaValidationConfig {
  fixMode: boolean;
  outputFormat: "console" | "json";
  queryPaths: string[];
  schemaPath: string;
}

interface ValidationResult {
  errors: string[];
  file: string;
  operation: string;
  suggestions?: string[];
  type: "mutation" | "query";
  valid: boolean;
}

class GraphQLSchemaValidator {
  private config: SchemaValidationConfig;
  private schema: ReturnType<typeof buildSchema>;

  constructor(config: SchemaValidationConfig) {
    this.config = config;
    this.loadSchema();
  }

  /**
   * Get available operations from the schema for reference
   */
  getAvailableOperations(): { mutations: string[]; queries: string[] } {
    const queryType = this.schema.getQueryType();
    const mutationType = this.schema.getMutationType();

    return {
      mutations:
        mutationType && "getFields" in mutationType
          ? Object.keys(mutationType.getFields()).sort()
          : [],
      queries:
        queryType && "getFields" in queryType
          ? Object.keys(queryType.getFields()).sort()
          : [],
    };
  }

  /**
   * Print available operations for reference
   */
  printAvailableOperations(): void {
    const { mutations, queries } = this.getAvailableOperations();

    console.log(`\n📋 Available Operations in Schema`);
    console.log(`═══════════════════════════════════`);

    console.log(`\n🔍 Queries (${queries.length}):`);
    queries.forEach((query) => console.log(`   • ${query}`));

    console.log(`\n✏️ Mutations (${mutations.length}):`);
    mutations.forEach((mutation) => console.log(`   • ${mutation}`));
  }

  /**
   * Print validation results to console
   */
  printResults(results: ValidationResult[]): void {
    const validResults = results.filter((r) => r.valid);
    const invalidResults = results.filter((r) => !r.valid);

    console.log(`\n📊 GraphQL Schema Validation Results`);
    console.log(`══════════════════════════════════════`);
    console.log(`✅ Valid operations: ${validResults.length}`);
    console.log(`❌ Invalid operations: ${invalidResults.length}`);
    console.log(
      `📁 Total files scanned: ${new Set(results.map((r) => r.file)).size}`,
    );

    if (validResults.length > 0) {
      console.log(`\n✅ Valid Operations:`);
      for (const result of validResults) {
        console.log(
          `   • ${result.operation} (${result.type}) in ${result.file}`,
        );
      }
    }

    if (invalidResults.length > 0) {
      console.log(`\n❌ Invalid Operations:`);
      for (const result of invalidResults) {
        console.log(
          `\n   ${result.operation} (${result.type}) in ${result.file}`,
        );
        for (const error of result.errors) {
          console.log(`     ❌ ${error}`);
        }

        if (result.suggestions && result.suggestions.length > 0) {
          console.log(`     💡 Suggestions:`);
          for (const suggestion of result.suggestions) {
            console.log(`        • ${suggestion}`);
          }
        }
      }
    }

    if (invalidResults.length > 0) {
      console.log(`\n🚨 Schema validation failed!`);
      console.log(`   Fix the invalid operations before deploying.`);
      console.log(
        `   Run with --fix-mode to get automated fixes (when available).`,
      );
    } else {
      console.log(`\n🎉 All GraphQL operations are valid!`);
    }
  }

  /**
   * Validate all GraphQL operations in the specified paths
   */
  async validateAll(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const pattern of this.config.queryPaths) {
      const files = await glob(pattern, { cwd: process.cwd() });

      for (const file of files) {
        const fileResults = await this.validateFile(file);
        results.push(...fileResults);
      }
    }

    return results;
  }

  /**
   * Extract GraphQL operations from a TypeScript file
   */
  private extractGraphQLOperations(content: string): Map<string, string> {
    const operations = new Map<string, string>();

    // Match exported const declarations with GraphQL content
    const operationRegex =
      /export\s+const\s+([A-Z_][A-Z0-9_]*(?:QUERY|MUTATION))\s*=\s*`([^`]+)`/g;

    let match;
    while ((match = operationRegex.exec(content)) !== null) {
      const [, operationName, operationContent] = match;
      operations.set(operationName, operationContent.trim());
    }

    return operations;
  }

  /**
   * Find alternative field names that might be similar to the requested field
   */
  private findAlternativeFields(
    operationType: "mutation" | "query",
    requestedField: string,
  ): string[] {
    const type =
      operationType === "query"
        ? this.schema.getQueryType()
        : this.schema.getMutationType();

    if (!type || !("getFields" in type)) {
      return [];
    }

    const fields = Object.keys(type.getFields());
    const alternatives: string[] = [];

    // Find fields that might be alternatives
    const requestedLower = requestedField.toLowerCase();

    for (const field of fields) {
      const fieldLower = field.toLowerCase();

      // Exact match (shouldn't happen if we're here, but just in case)
      if (fieldLower === requestedLower) {
        continue;
      }

      // Check for partial matches or similar patterns
      if (
        fieldLower.includes(
          requestedLower.substring(0, Math.min(5, requestedLower.length)),
        ) ||
        requestedLower.includes(
          fieldLower.substring(0, Math.min(5, fieldLower.length)),
        )
      ) {
        alternatives.push(field);
      }
    }

    return alternatives.slice(0, 3); // Limit to top 3 suggestions
  }

  /**
   * Generate suggestions for fixing validation errors
   */
  private generateSuggestions(
    operationType: "mutation" | "query",
    errors: GraphQLError[],
  ): string[] {
    const suggestions: string[] = [];

    for (const error of errors) {
      const message = error.message.toLowerCase();

      if (message.includes("field") && message.includes("doesn't exist")) {
        // Extract field name from error message
        const fieldMatch = error.message.match(/Field "([^"]+)"/);
        if (fieldMatch) {
          const fieldName = fieldMatch[1];
          const alternatives = this.findAlternativeFields(
            operationType,
            fieldName,
          );

          if (alternatives.length > 0) {
            suggestions.push(
              `Consider using one of these fields instead: ${alternatives.join(", ")}`,
            );
          }
        }
      }

      if (message.includes("brandagent") && message.includes("doesn't exist")) {
        suggestions.push(
          "Try using 'agents' instead of 'brandAgents' for listing operations",
        );
        suggestions.push(
          "Try using 'agent(id: String!)' instead of 'brandAgent(id: String!)' for single queries",
        );
      }

      if (message.includes("tactic")) {
        suggestions.push(
          "Tactic operations are not available in GraphQL - use BigQuery service instead",
        );
        suggestions.push(
          "Remove GraphQL tactic operations and implement BigQuery-only approach",
        );
      }
    }

    return suggestions;
  }

  private loadSchema(): void {
    try {
      const schemaPath = join(process.cwd(), this.config.schemaPath);

      if (!existsSync(schemaPath)) {
        throw new Error(`Schema file not found: ${schemaPath}`);
      }

      const schemaSDL = readFileSync(schemaPath, "utf-8");
      this.schema = buildSchema(schemaSDL);

      console.log(`✅ Loaded GraphQL schema from ${this.config.schemaPath}`);
    } catch (error) {
      console.error(
        `❌ Failed to load GraphQL schema: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(2);
    }
  }

  /**
   * Validate all GraphQL operations in a single file
   */
  private async validateFile(filePath: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    try {
      const content = readFileSync(filePath, "utf-8");
      const operations = this.extractGraphQLOperations(content);

      for (const [operationName, operation] of operations.entries()) {
        const result = this.validateOperation(
          filePath,
          operationName,
          operation,
        );
        results.push(result);
      }
    } catch (error) {
      console.warn(
        `⚠️ Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return results;
  }

  /**
   * Validate a single GraphQL operation against the schema
   */
  private validateOperation(
    file: string,
    operationName: string,
    operation: string,
  ): ValidationResult {
    const operationType = operationName.includes("MUTATION")
      ? "mutation"
      : "query";

    try {
      const document = parse(operation);
      const errors = validate(this.schema, document);

      if (errors.length === 0) {
        return {
          errors: [],
          file,
          operation: operationName,
          type: operationType,
          valid: true,
        };
      }

      const errorMessages = errors.map(
        (error: GraphQLError) =>
          `${error.message} (line ${error.locations?.[0]?.line || "unknown"})`,
      );

      const suggestions = this.generateSuggestions(operationType, errors);

      return {
        errors: errorMessages,
        file,
        operation: operationName,
        suggestions,
        type: operationType,
        valid: false,
      };
    } catch (parseError) {
      return {
        errors: [
          `Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        ],
        file,
        operation: operationName,
        type: operationType,
        valid: false,
      };
    }
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fixMode = args.includes("--fix-mode");
  const showOperations = args.includes("--show-operations");

  const config: SchemaValidationConfig = {
    fixMode,
    outputFormat: "console",
    queryPaths: ["src/client/queries/*.ts", "src/**/*.ts"],
    schemaPath: "scope3-backend@current--#@!api!@#.graphql",
  };

  console.log(`🔍 Starting GraphQL schema validation...`);
  console.log(`   Schema: ${config.schemaPath}`);
  console.log(`   Patterns: ${config.queryPaths.join(", ")}`);

  const validator = new GraphQLSchemaValidator(config);

  if (showOperations) {
    validator.printAvailableOperations();
    return;
  }

  const results = await validator.validateAll();
  validator.printResults(results);

  const hasErrors = results.some((r) => !r.valid);

  if (hasErrors) {
    console.log(
      `\n💡 Tip: Run with --show-operations to see all available schema operations`,
    );
    process.exit(1);
  }

  console.log(`\n✨ Schema validation completed successfully!`);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(
      `💥 Validation script failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(2);
  });
}

export {
  GraphQLSchemaValidator,
  type SchemaValidationConfig,
  type ValidationResult,
};
