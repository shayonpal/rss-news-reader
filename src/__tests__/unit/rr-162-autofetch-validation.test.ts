/**
 * Unit tests for RR-162 AutoFetch validation with type safety
 */
import { describe, it, expect, vi } from "vitest";
import {
  AutoFetchValidation,
  PROHIBITED_FIELDS,
} from "@/contracts/rr-162-autofetch";

describe("RR-162: AutoFetch Validation Type Safety", () => {
  describe("Type Guards", () => {
    it("should correctly identify objects", () => {
      expect(AutoFetchValidation.isObject({})).toBe(true);
      expect(AutoFetchValidation.isObject({ key: "value" })).toBe(true);
      expect(AutoFetchValidation.isObject(null)).toBe(false);
      expect(AutoFetchValidation.isObject(undefined)).toBe(false);
      expect(AutoFetchValidation.isObject([])).toBe(false);
      expect(AutoFetchValidation.isObject("string")).toBe(false);
      expect(AutoFetchValidation.isObject(123)).toBe(false);
    });

    it("should safely check property existence", () => {
      const obj = { existingProp: "value" };
      expect(AutoFetchValidation.hasProperty(obj, "existingProp")).toBe(true);
      expect(AutoFetchValidation.hasProperty(obj, "nonExistent")).toBe(false);
      expect(AutoFetchValidation.hasProperty(null, "prop")).toBe(false);
      expect(AutoFetchValidation.hasProperty("string", "prop")).toBe(false);
    });
  });

  describe("Prohibited Fields Checking", () => {
    it("should detect prohibited fields with type safety", () => {
      const objWithProhibited = {
        normalField: "value",
        autoFetchFullContent: true,
      };

      expect(() =>
        AutoFetchValidation.checkProhibitedFields(
          objWithProhibited,
          "test object"
        )
      ).toThrow(
        "Prohibited field 'autoFetchFullContent' must not exist in test object"
      );
    });

    it("should handle non-objects safely", () => {
      expect(() =>
        AutoFetchValidation.checkProhibitedFields(null, "null value")
      ).not.toThrow();

      expect(() =>
        AutoFetchValidation.checkProhibitedFields(undefined, "undefined value")
      ).not.toThrow();

      expect(() =>
        AutoFetchValidation.checkProhibitedFields("string", "string value")
      ).not.toThrow();
    });
  });

  describe("Recursive Validation with Depth Protection", () => {
    it("should handle deeply nested objects with depth limit", () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    level7: {
                      level8: {
                        level9: {
                          level10: {
                            level11: {
                              autoFetchFullContent: true, // Beyond default depth
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Should not throw because the prohibited field is beyond the max depth
      expect(() =>
        AutoFetchValidation.validateNoProhibitedFields(deepObject)
      ).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Max depth reached in validateNoProhibitedFields, stopping recursion"
      );

      consoleSpy.mockRestore();
    });

    it("should detect prohibited fields within depth limit", () => {
      const shallowObject = {
        level1: {
          level2: {
            autoFetchFullContent: true, // Within default depth of 10
          },
        },
      };

      expect(() =>
        AutoFetchValidation.validateNoProhibitedFields(shallowObject)
      ).toThrow("Prohibited auto-fetch field 'autoFetchFullContent' detected");
    });

    it("should handle circular references safely", () => {
      const circular: any = { name: "root" };
      circular.self = circular; // Create circular reference
      circular.nested = { parent: circular }; // Another circular reference

      // Should not cause stack overflow
      expect(() =>
        AutoFetchValidation.validateNoProhibitedFields(circular)
      ).not.toThrow();
    });

    it("should detect prohibited fields before circular reference", () => {
      const circular: any = {
        name: "root",
        autoFetchFullContent: true, // Prohibited field
      };
      circular.self = circular;

      expect(() =>
        AutoFetchValidation.validateNoProhibitedFields(circular)
      ).toThrow("Prohibited auto-fetch field 'autoFetchFullContent' detected");
    });
  });

  describe("Integration with Validation Methods", () => {
    it("should use type-safe checking in validatePreferences", () => {
      const prefsWithProhibited = {
        theme: "dark" as const,
        syncFrequency: 30,
        maxArticles: 100,
        enableNotifications: false,
        autoFetchFullContent: true, // Prohibited
      };

      expect(() =>
        AutoFetchValidation.validatePreferences(prefsWithProhibited)
      ).toThrow(
        "Prohibited field 'autoFetchFullContent' must not exist in preferences"
      );
    });

    it("should use type-safe checking in validateSyncProgress", () => {
      const syncWithProhibited = {
        status: "in-progress" as const,
        progress: 50,
        message: "Syncing...",
        itemsProcessed: 100,
        totalItems: 200,
        AUTO_FETCH_RATE_LIMIT: 10, // Prohibited
      };

      expect(() =>
        AutoFetchValidation.validateSyncProgress(syncWithProhibited)
      ).toThrow(
        "Prohibited field 'AUTO_FETCH_RATE_LIMIT' must not exist in sync response"
      );
    });

    it("should validate all prohibited fields are checked", () => {
      // Ensure we're checking all defined prohibited fields
      PROHIBITED_FIELDS.forEach((field) => {
        const objWithField = { [field]: "any value" };

        expect(() =>
          AutoFetchValidation.checkProhibitedFields(objWithField, "test")
        ).toThrow(`Prohibited field '${field}' must not exist in test`);
      });
    });
  });
});
