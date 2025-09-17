/**
 * BigQuery Type Conversion Utilities
 *
 * Standardized type conversion functions for BigQuery parameter handling.
 * These ensure consistent type conversion across all BigQuery services.
 */

/**
 * Converts boolean to BigQuery BOOL type
 *
 * @param value - Boolean value to convert
 * @returns Boolean value (handles falsy conversion)
 */
export function toBigQueryBool(value: unknown): boolean {
  return Boolean(value);
}

/**
 * Converts string ID to BigQuery INT64 type
 *
 * @param value - String value to convert
 * @returns Converted integer value
 * @throws Error if conversion fails
 */
export function toBigQueryInt64(value: string): number {
  const converted = parseInt(value, 10);
  if (isNaN(converted)) {
    throw new Error(`Invalid INT64 value: ${value}`);
  }
  return converted;
}

/**
 * Converts object to JSON string for BigQuery JSON columns
 *
 * @param value - Object to convert, or null
 * @returns JSON string or null
 */
export function toBigQueryJson(value: unknown): null | string {
  if (value === null || value === undefined) {
    return null;
  }
  return JSON.stringify(value);
}

/**
 * Converts string to BigQuery STRING type (with validation)
 *
 * @param value - String value to validate
 * @returns Validated string
 * @throws Error if value is null or undefined
 */
export function toBigQueryString(value: null | string | undefined): string {
  if (value === null || value === undefined) {
    throw new Error("String value cannot be null or undefined");
  }
  return value;
}

/**
 * Type mapping object for BigQuery parameter types
 * Use this for consistent type specification in BigQuery queries
 */
export const BigQueryTypes = {
  BOOL: "BOOL" as const,
  FLOAT64: "FLOAT64" as const,
  INT64: "INT64" as const,
  JSON: "JSON" as const,
  STRING: "STRING" as const,
  TIMESTAMP: "TIMESTAMP" as const,
} as const;

/**
 * Creates a complete parameter object with proper typing for BigQuery
 *
 * @param params - Raw parameter values
 * @param typeMap - Type mapping for each parameter
 * @returns Object with params and types for BigQuery query
 */
export function createBigQueryParams<T extends Record<string, unknown>>(
  params: T,
  typeMap: Record<keyof T, string>,
): {
  params: T;
  types: Record<keyof T, string>;
} {
  return {
    params,
    types: typeMap,
  };
}
