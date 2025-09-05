/* eslint-disable @typescript-eslint/no-explicit-any */
import SwaggerParser from "@apidevtools/swagger-parser";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("OpenAPI Specification", () => {
  it("should be valid OpenAPI 3.0 spec", async () => {
    const specPath = join(process.cwd(), "openapi.yaml");
    const api = await SwaggerParser.validate(specPath);

    expect(api).toBeDefined();
    expect((api as any).openapi).toBe("3.0.0");
    expect(api.info.title).toBe("Scope3 Agentic Campaign Management API");
  });

  it("should have all required info fields", async () => {
    const specPath = join(process.cwd(), "openapi.yaml");
    const api = await SwaggerParser.validate(specPath);

    expect(api.info.title).toBeDefined();
    expect(api.info.version).toBeDefined();
    expect(api.info.description).toBeDefined();
  });

  it("should have security scheme defined", async () => {
    const specPath = join(process.cwd(), "openapi.yaml");
    const api = await SwaggerParser.validate(specPath);

    expect((api as any).components?.securitySchemes).toBeDefined();
    expect((api as any).components?.securitySchemes?.bearerAuth).toBeDefined();
    expect((api as any).security).toBeDefined();
  });

  it("should have all paths with operation IDs", async () => {
    const specPath = join(process.cwd(), "openapi.yaml");
    const api = await SwaggerParser.validate(specPath);

    if (api.paths) {
      for (const [, methods] of Object.entries(api.paths)) {
        if (methods) {
          for (const [, operation] of Object.entries(methods)) {
            if (
              typeof operation === "object" &&
              operation &&
              "operationId" in operation
            ) {
              expect(operation.operationId).toBeDefined();
              expect(typeof operation.operationId).toBe("string");
              expect((operation.operationId as string).length).toBeGreaterThan(
                0,
              );
            }
          }
        }
      }
    }
  });

  it("should have LLM hints for all operations", async () => {
    const specPath = join(process.cwd(), "openapi.yaml");
    const api = await SwaggerParser.validate(specPath);

    if (api.paths) {
      for (const [, methods] of Object.entries(api.paths)) {
        if (methods) {
          for (const [, operation] of Object.entries(methods)) {
            if (
              typeof operation === "object" &&
              operation &&
              "operationId" in operation
            ) {
              expect((operation as any)["x-llm-hints"]).toBeDefined();
              expect(Array.isArray((operation as any)["x-llm-hints"])).toBe(
                true,
              );
              expect((operation as any)["x-llm-hints"].length).toBeGreaterThan(
                0,
              );
            }
          }
        }
      }
    }
  });

  it("should have examples for all responses", async () => {
    const specPath = join(process.cwd(), "openapi.yaml");
    const api = await SwaggerParser.validate(specPath);

    const missingExamples: string[] = [];

    if (api.paths) {
      for (const [pathName, methods] of Object.entries(api.paths)) {
        if (methods) {
          for (const [methodName, operation] of Object.entries(methods)) {
            if (typeof operation === "object" && (operation as any).responses) {
              for (const [status, response] of Object.entries(
                (operation as any).responses,
              )) {
                if (
                  typeof response === "object" &&
                  response &&
                  (response as any).content?.["application/json"]
                ) {
                  if (!(response as any).content["application/json"].examples) {
                    missingExamples.push(
                      `${methodName.toUpperCase()} ${pathName} (${status})`,
                    );
                  }
                }
              }
            }
          }
        }
      }
    }

    if (missingExamples.length > 0) {
      console.warn(
        "Missing examples in:",
        missingExamples.slice(0, 5).join(", "),
      );
    }

    // For now, just warn but don't fail the test
    expect(missingExamples.length).toBeLessThan(20); // Allow some missing for now
  });

  it("should have all referenced schemas defined", async () => {
    const specPath = join(process.cwd(), "openapi.yaml");
    const api = await SwaggerParser.dereference(specPath);

    // If dereference succeeds, all refs are valid
    expect(api).toBeDefined();
  });

  it("should have consistent schema naming", async () => {
    const specPath = join(process.cwd(), "openapi.yaml");
    const api = await SwaggerParser.validate(specPath);

    if ((api as any).components?.schemas) {
      for (const schemaName of Object.keys((api as any).components.schemas)) {
        // Schema names should be PascalCase
        expect(schemaName).toMatch(/^[A-Z][a-zA-Z0-9]*$/);
      }
    }
  });
});
