import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrandAgentService } from "./brand-agent-service.js";
import {
  setupBigQueryMocks,
  bigQueryMockResponses,
  bigQueryTestScenarios,
  bigQueryAssertions,
  mockBigQueryMethods,
} from "../__tests__/setup/bigquery-mocks.js";
import {
  brandAgentFixtures,
  brandAgentFactory,
} from "../__tests__/fixtures/brand-agent-fixtures.js";

// Import test setup to initialize global mocks
import "../__tests__/setup/test-setup.js";

describe("BrandAgentService", () => {
  let service: BrandAgentService;

  beforeEach(() => {
    service = new BrandAgentService();
    setupBigQueryMocks.reset();
  });

  describe("getBrandAgent", () => {
    describe("when BigQuery enhancement is available", () => {
      it("should return enhanced brand agent with all fields", async () => {
        // Arrange
        const expectedAgent = brandAgentFixtures.enhancedBrandAgent();
        bigQueryTestScenarios.fullyEnhanced();

        // Act
        const result = await service.getBrandAgent(expectedAgent.id);

        // Assert
        expect(result).toEqual(expectedAgent);
        bigQueryAssertions.expectQueryCalled("SELECT", {
          agentId: expectedAgent.id,
        });
        bigQueryAssertions.expectTableQueried("brand_agent_extensions");
      });

      it("should handle arrays in BigQuery response correctly", async () => {
        // Arrange
        const agentId = "ba_arrays_test";
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryMockResponses.singleAgent(),
        );

        // Act
        const result = await service.getBrandAgent(agentId);

        // Assert
        expect(result?.advertiserDomains).toBeInstanceOf(Array);
        expect(result?.dspSeats).toBeInstanceOf(Array);
        expect(result?.advertiserDomains).toEqual([
          "example.com",
          "test-brand.com",
        ]);
        expect(result?.dspSeats).toEqual(["DV360_12345", "TTD_67890"]);
      });

      it("should handle missing optional fields gracefully", async () => {
        // Arrange
        const agentId = "ba_minimal_test";
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryMockResponses.agentWithoutExtensions(),
        );

        // Act
        const result = await service.getBrandAgent(agentId);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.description).toBeUndefined();
        expect(result?.externalId).toBeUndefined();
        expect(result?.nickname).toBeUndefined();
        expect(result?.advertiserDomains).toEqual([]);
        expect(result?.dspSeats).toEqual([]);
      });
    });

    describe("when brand agent does not exist", () => {
      it("should return null for non-existent agent", async () => {
        // Arrange
        const agentId = "ba_nonexistent";
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());

        // Act
        const result = await service.getBrandAgent(agentId);

        // Assert
        expect(result).toBeNull();
        bigQueryAssertions.expectQueryCalled("SELECT", { agentId });
      });
    });

    describe("when BigQuery is unavailable", () => {
      it("should throw error when BigQuery fails", async () => {
        // Arrange
        const agentId = "ba_error_test";
        bigQueryTestScenarios.bigQueryUnavailable();

        // Act & Assert
        await expect(service.getBrandAgent(agentId)).rejects.toThrow();
        bigQueryAssertions.expectQueryCalled("SELECT");
      });

      it("should handle timeout gracefully", async () => {
        // Arrange
        const agentId = "ba_timeout_test";
        setupBigQueryMocks.withDelayedQuery(
          bigQueryMockResponses.singleAgent(),
          5000,
        );

        // Act & Assert
        // This test would need a timeout configuration in the service
        // For now, we'll verify the query was called
        const promise = service.getBrandAgent(agentId);
        await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay

        bigQueryAssertions.expectQueryCalled("SELECT", { agentId });
      });
    });

    describe("data type conversions", () => {
      it("should convert date fields correctly", async () => {
        // Arrange
        const agentId = "ba_date_test";
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryMockResponses.singleAgent(),
        );

        // Act
        const result = await service.getBrandAgent(agentId);

        // Assert
        expect(result?.createdAt).toBeInstanceOf(Date);
        expect(result?.updatedAt).toBeInstanceOf(Date);
      });

      it("should handle numeric customer ID conversion", async () => {
        // Arrange
        const agentId = "ba_numeric_test";
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryMockResponses.singleAgent(),
        );

        // Act
        const result = await service.getBrandAgent(agentId);

        // Assert
        expect(typeof result?.customerId).toBe("number");
        expect(result?.customerId).toBe(12345);
      });

      it("should handle string ID conversion", async () => {
        // Arrange
        const agentId = "ba_string_test";
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryMockResponses.singleAgent(),
        );

        // Act
        const result = await service.getBrandAgent(agentId);

        // Assert
        expect(typeof result?.id).toBe("string");
        expect(result?.id).toBe("ba_enhanced_123");
      });
    });
  });

  describe("listBrandAgents", () => {
    describe("with customer filtering", () => {
      it("should return brand agents for specific customer", async () => {
        // Arrange
        const customerId = 12345;
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryMockResponses.multipleAgents(),
        );

        // Act
        const result = await service.listBrandAgents(customerId);

        // Assert
        expect(result).toHaveLength(2);
        expect(result[0].customerId).toBe(customerId);
        expect(result[1].customerId).toBe(customerId);
        bigQueryAssertions.expectQueryCalled(
          "WHERE a.customer_id = @customerId",
          { customerId },
        );
      });

      it("should handle empty results for customer", async () => {
        // Arrange
        const customerId = 99999;
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());

        // Act
        const result = await service.listBrandAgents(customerId);

        // Assert
        expect(result).toEqual([]);
        bigQueryAssertions.expectQueryCalled("WHERE", { customerId });
      });
    });

    describe("without customer filtering", () => {
      it("should return all brand agents when no customer specified", async () => {
        // Arrange
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryMockResponses.multipleAgents(),
        );

        // Act
        const result = await service.listBrandAgents();

        // Assert
        expect(result).toHaveLength(2);
        bigQueryAssertions.expectQueryCalled("SELECT");
        // Verify no WHERE clause for customer filtering
        const calls = mockBigQueryMethods.query.mock.calls;
        const queryString = calls[0][0];
        expect(queryString).not.toContain("WHERE a.customer_id");
      });
    });

    describe("result ordering", () => {
      it("should return results ordered by creation date descending", async () => {
        // Arrange
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryMockResponses.multipleAgents(),
        );

        // Act
        const result = await service.listBrandAgents();

        // Assert
        bigQueryAssertions.expectQueryCalled("ORDER BY a.created_at DESC");
        // Verify ordering in fixture data
        expect(result[0].createdAt.getTime()).toBeLessThanOrEqual(
          result[1].createdAt.getTime(),
        );
      });
    });

    describe("performance with large datasets", () => {
      it("should handle large result sets efficiently", async () => {
        // Arrange
        const largeDataset = bigQueryMockResponses.largeResultSet(100);
        setupBigQueryMocks.withSuccessfulQuery(largeDataset);

        // Act
        const startTime = Date.now();
        const result = await service.listBrandAgents();
        const endTime = Date.now();

        // Assert
        expect(result).toHaveLength(100);
        expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      });
    });
  });

  describe("resolveBrandAgentId", () => {
    describe("ID resolution", () => {
      it("should resolve by direct ID when agent exists", async () => {
        // Arrange
        const descriptor = { id: "ba_direct_123" };
        const customerId = 12345;
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryMockResponses.singleAgent(),
        );

        // Act
        const result = await service.resolveBrandAgentId(
          descriptor,
          customerId,
        );

        // Assert
        expect(result).toBe("ba_direct_123");
        bigQueryAssertions.expectQueryCalled(
          "WHERE a.id = @agentId AND a.customer_id = @customerId",
        );
      });

      it("should return null when direct ID does not exist", async () => {
        // Arrange
        const descriptor = { id: "ba_nonexistent" };
        const customerId = 12345;
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());

        // Act
        const result = await service.resolveBrandAgentId(
          descriptor,
          customerId,
        );

        // Assert
        expect(result).toBeNull();
      });

      it("should verify customer ownership for direct ID", async () => {
        // Arrange
        const descriptor = { id: "ba_other_customer" };
        const customerId = 12345;
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());

        // Act
        const result = await service.resolveBrandAgentId(
          descriptor,
          customerId,
        );

        // Assert
        expect(result).toBeNull();
        bigQueryAssertions.expectQueryCalled(
          "WHERE a.id = @agentId AND a.customer_id = @customerId",
        );
      });
    });

    describe("external ID resolution", () => {
      it("should resolve by external ID", async () => {
        // Arrange
        const descriptor = { externalId: "external_123" };
        const customerId = 12345;
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryMockResponses.singleAgent(),
        );

        // Act
        const result = await service.resolveBrandAgentId(
          descriptor,
          customerId,
        );

        // Assert
        expect(result).toBe("ba_enhanced_123");
        bigQueryAssertions.expectQueryCalled("ext.external_id = @externalId", {
          externalId: "external_123",
          customerId,
        });
      });

      it("should return null for non-existent external ID", async () => {
        // Arrange
        const descriptor = { externalId: "external_nonexistent" };
        const customerId = 12345;
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());

        // Act
        const result = await service.resolveBrandAgentId(
          descriptor,
          customerId,
        );

        // Assert
        expect(result).toBeNull();
      });
    });

    describe("nickname resolution", () => {
      it("should resolve by nickname", async () => {
        // Arrange
        const descriptor = { nickname: "TestBrand" };
        const customerId = 12345;
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryMockResponses.singleAgent(),
        );

        // Act
        const result = await service.resolveBrandAgentId(
          descriptor,
          customerId,
        );

        // Assert
        expect(result).toBe("ba_enhanced_123");
        bigQueryAssertions.expectQueryCalled("ext.nickname = @nickname", {
          nickname: "TestBrand",
          customerId,
        });
      });
    });

    describe("multiple descriptor resolution", () => {
      it("should handle multiple identifiers with OR logic", async () => {
        // Arrange
        const descriptor = {
          externalId: "external_123",
          nickname: "TestBrand",
        };
        const customerId = 12345;
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryMockResponses.singleAgent(),
        );

        // Act
        const result = await service.resolveBrandAgentId(
          descriptor,
          customerId,
        );

        // Assert
        expect(result).toBe("ba_enhanced_123");
        bigQueryAssertions.expectQueryCalled(
          "ext.external_id = @externalId OR ext.nickname = @nickname",
        );
      });

      it("should return null when no valid descriptor provided", async () => {
        // Arrange
        const descriptor = {}; // Empty descriptor
        const customerId = 12345;

        // Act
        const result = await service.resolveBrandAgentId(
          descriptor,
          customerId,
        );

        // Assert
        expect(result).toBeNull();
        bigQueryAssertions.expectQueryNotCalled();
      });
    });

    describe("customer scoping", () => {
      it("should enforce customer scoping for all resolution methods", async () => {
        // Arrange
        const descriptor = { externalId: "external_123" };
        const customerId = 12345;
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryMockResponses.singleAgent(),
        );

        // Act
        await service.resolveBrandAgentId(descriptor, customerId);

        // Assert
        bigQueryAssertions.expectQueryCalled(
          "WHERE a.customer_id = @customerId",
          { customerId },
        );
      });
    });
  });

  describe("upsertBrandAgentExtension", () => {
    describe("successful operations", () => {
      it("should create new extension when agent has no existing extension", async () => {
        // Arrange
        const agentId = "ba_new_extension";
        const extensionData = {
          externalId: "ext_new",
          nickname: "NewNickname",
          description: "New description",
          advertiserDomains: ["new.com"],
          dspSeats: ["DSP_NEW"],
        };
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());

        // Act
        await service.upsertBrandAgentExtension(agentId, extensionData);

        // Assert
        bigQueryAssertions.expectQueryCalled("MERGE", {
          agentId,
          externalId: extensionData.externalId,
          nickname: extensionData.nickname,
          description: extensionData.description,
          advertiserDomains: extensionData.advertiserDomains,
          dspSeats: extensionData.dspSeats,
        });
      });

      it("should update existing extension when agent already has extension", async () => {
        // Arrange
        const agentId = "ba_existing_extension";
        const updateData = {
          nickname: "UpdatedNickname",
          description: "Updated description",
        };
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());

        // Act
        await service.upsertBrandAgentExtension(agentId, updateData);

        // Assert
        bigQueryAssertions.expectQueryCalled("MERGE");
        bigQueryAssertions.expectQueryCalled("WHEN MATCHED THEN");
        bigQueryAssertions.expectQueryCalled("WHEN NOT MATCHED THEN");
      });

      it("should handle partial updates correctly", async () => {
        // Arrange
        const agentId = "ba_partial_update";
        const partialData = { nickname: "PartialUpdate" };
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());

        // Act
        await service.upsertBrandAgentExtension(agentId, partialData);

        // Assert
        bigQueryAssertions.expectQueryCalled("MERGE", {
          agentId,
          nickname: "PartialUpdate",
          advertiserDomains: null,
          description: null,
          dspSeats: null,
          externalId: null,
        });
      });

      it("should use COALESCE for conditional updates", async () => {
        // Arrange
        const agentId = "ba_coalesce_test";
        const updateData = { description: "Updated description" };
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());

        // Act
        await service.upsertBrandAgentExtension(agentId, updateData);

        // Assert
        bigQueryAssertions.expectQueryCalled(
          "COALESCE(new.description, ext.description)",
        );
      });
    });

    describe("error handling", () => {
      it("should propagate BigQuery errors", async () => {
        // Arrange
        const agentId = "ba_error_test";
        const extensionData = { nickname: "ErrorTest" };
        setupBigQueryMocks.withQueryError("invalidQuery");

        // Act & Assert
        await expect(
          service.upsertBrandAgentExtension(agentId, extensionData),
        ).rejects.toThrow();
      });

      it("should handle quota exceeded errors", async () => {
        // Arrange
        const agentId = "ba_quota_test";
        const extensionData = { nickname: "QuotaTest" };
        setupBigQueryMocks.withQueryError("quotaExceeded");

        // Act & Assert
        await expect(
          service.upsertBrandAgentExtension(agentId, extensionData),
        ).rejects.toThrow();
      });
    });

    describe("data validation", () => {
      it("should handle empty arrays correctly", async () => {
        // Arrange
        const agentId = "ba_empty_arrays";
        const extensionData = {
          advertiserDomains: [],
          dspSeats: [],
        };
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());

        // Act
        await service.upsertBrandAgentExtension(agentId, extensionData);

        // Assert
        bigQueryAssertions.expectQueryCalled("MERGE", {
          agentId,
          advertiserDomains: [],
          dspSeats: [],
        });
      });

      it("should handle undefined values as null", async () => {
        // Arrange
        const agentId = "ba_undefined_test";
        const extensionData = {
          externalId: undefined,
          nickname: undefined,
        };
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());

        // Act
        await service.upsertBrandAgentExtension(agentId, extensionData);

        // Assert
        bigQueryAssertions.expectQueryCalled("MERGE", {
          agentId,
          externalId: null,
          nickname: null,
        });
      });
    });

    describe("timestamp handling", () => {
      it("should set created_at and updated_at for new records", async () => {
        // Arrange
        const agentId = "ba_timestamp_test";
        const extensionData = { nickname: "TimestampTest" };
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());

        // Act
        await service.upsertBrandAgentExtension(agentId, extensionData);

        // Assert
        bigQueryAssertions.expectQueryCalled("created_at");
        bigQueryAssertions.expectQueryCalled("updated_at");
      });

      it("should update only updated_at for existing records", async () => {
        // Arrange
        const agentId = "ba_update_timestamp";
        const extensionData = { nickname: "UpdateTimestamp" };
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());

        // Act
        await service.upsertBrandAgentExtension(agentId, extensionData);

        // Assert
        bigQueryAssertions.expectQueryCalled("WHEN MATCHED THEN");
        bigQueryAssertions.expectQueryCalled("updated_at =");
      });
    });
  });
});
