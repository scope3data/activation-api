import { describe } from "vitest";

import { BriefValidationServiceTestDouble } from "../../test-doubles/brief-validation-service-test-double.js";
import { testBriefValidationServiceContract } from "../contracts/brief-validation-service.contract.test.js";

describe("Brief Validation Service Contract Validation", () => {
  // Test that our test double implementation follows the contract
  testBriefValidationServiceContract(
    () => new BriefValidationServiceTestDouble(),
  );
});
