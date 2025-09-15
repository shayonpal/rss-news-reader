import { describe, it, expect } from "vitest";
import {
  validatePreferences,
  clampNumericValue,
  validateTimeFormat,
  PREFERENCES_CONSTRAINTS,
} from "@/lib/utils/preferences-validator";
import type { UserPreferences } from "@/types/preferences";

describe("PreferencesValidator", () => {
  const validPreferences: UserPreferences = {
    id: "user-123",
    userId: "user-123",
    theme: "system",
    syncEnabled: true,
    maxArticles: 100,
    retentionDays: 30,
    retentionCount: 100,
    feedOrder: "alphabetical",
    showUnreadOnly: false,
    markAsReadOnOpen: true,
    enableNotifications: false,
    notificationTime: null,
    inoreaderApiKey: null,
    claudeApiKey: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe("validatePreferences", () => {
    it("should return no errors for valid preferences", () => {
      const errors = validatePreferences(validPreferences);
      expect(errors).toEqual({});
    });

    it("should validate maxArticles range", () => {
      // Below minimum
      let errors = validatePreferences({
        ...validPreferences,
        maxArticles: 5,
      });
      expect(errors.maxArticles).toContain("between 10 and 5000");

      // Above maximum
      errors = validatePreferences({
        ...validPreferences,
        maxArticles: 10000,
      });
      expect(errors.maxArticles).toContain("between 10 and 5000");

      // At minimum boundary
      errors = validatePreferences({
        ...validPreferences,
        maxArticles: 10,
      });
      expect(errors.maxArticles).toBeUndefined();

      // At maximum boundary
      errors = validatePreferences({
        ...validPreferences,
        maxArticles: 5000,
      });
      expect(errors.maxArticles).toBeUndefined();
    });

    it("should validate retentionDays range", () => {
      // Below minimum
      let errors = validatePreferences({
        ...validPreferences,
        retentionDays: 0,
      });
      expect(errors.retentionDays).toContain("between 1 and 365");

      // Above maximum
      errors = validatePreferences({
        ...validPreferences,
        retentionDays: 400,
      });
      expect(errors.retentionDays).toContain("between 1 and 365");

      // Valid value
      errors = validatePreferences({
        ...validPreferences,
        retentionDays: 180,
      });
      expect(errors.retentionDays).toBeUndefined();
    });

    it("should validate retentionCount range", () => {
      // Below minimum
      let errors = validatePreferences({
        ...validPreferences,
        retentionCount: 0,
      });
      expect(errors.retentionCount).toContain("between 1 and 365");

      // Above maximum
      errors = validatePreferences({
        ...validPreferences,
        retentionCount: 500,
      });
      expect(errors.retentionCount).toContain("between 1 and 365");

      // Valid value
      errors = validatePreferences({
        ...validPreferences,
        retentionCount: 200,
      });
      expect(errors.retentionCount).toBeUndefined();
    });

    it("should validate notification time format", () => {
      // Valid formats
      let errors = validatePreferences({
        ...validPreferences,
        notificationTime: "09:00",
      });
      expect(errors.notificationTime).toBeUndefined();

      errors = validatePreferences({
        ...validPreferences,
        notificationTime: "23:59",
      });
      expect(errors.notificationTime).toBeUndefined();

      // Invalid formats
      errors = validatePreferences({
        ...validPreferences,
        notificationTime: "25:00",
      });
      expect(errors.notificationTime).toContain("Invalid time format");

      errors = validatePreferences({
        ...validPreferences,
        notificationTime: "12:60",
      });
      expect(errors.notificationTime).toContain("Invalid time format");

      errors = validatePreferences({
        ...validPreferences,
        notificationTime: "invalid",
      });
      expect(errors.notificationTime).toContain("Invalid time format");

      // Null is valid
      errors = validatePreferences({
        ...validPreferences,
        notificationTime: null,
      });
      expect(errors.notificationTime).toBeUndefined();
    });

    it("should validate theme values", () => {
      const validThemes = ["system", "light", "dark"] as const;

      for (const theme of validThemes) {
        const errors = validatePreferences({
          ...validPreferences,
          theme,
        });
        expect(errors.theme).toBeUndefined();
      }

      // Invalid theme
      const errors = validatePreferences({
        ...validPreferences,
        theme: "invalid" as any,
      });
      expect(errors.theme).toContain("Invalid theme");
    });

    it("should validate feedOrder values", () => {
      const validOrders = ["alphabetical", "recent", "unread"] as const;

      for (const order of validOrders) {
        const errors = validatePreferences({
          ...validPreferences,
          feedOrder: order,
        });
        expect(errors.feedOrder).toBeUndefined();
      }

      // Invalid feedOrder
      const errors = validatePreferences({
        ...validPreferences,
        feedOrder: "invalid" as any,
      });
      expect(errors.feedOrder).toContain("Invalid feed order");
    });

    it("should handle multiple validation errors", () => {
      const errors = validatePreferences({
        ...validPreferences,
        maxArticles: 5,
        retentionDays: 400,
        retentionCount: 0,
        notificationTime: "invalid",
        theme: "invalid" as any,
        feedOrder: "invalid" as any,
      });

      expect(Object.keys(errors).length).toBe(6);
      expect(errors.maxArticles).toBeDefined();
      expect(errors.retentionDays).toBeDefined();
      expect(errors.retentionCount).toBeDefined();
      expect(errors.notificationTime).toBeDefined();
      expect(errors.theme).toBeDefined();
      expect(errors.feedOrder).toBeDefined();
    });

    it("should handle missing or undefined values gracefully", () => {
      const partialPreferences = {
        ...validPreferences,
        maxArticles: undefined as any,
        retentionDays: undefined as any,
      };

      const errors = validatePreferences(partialPreferences);
      // Undefined numeric values should be treated as invalid
      expect(errors.maxArticles).toBeDefined();
      expect(errors.retentionDays).toBeDefined();
    });

    it("should validate negative numbers", () => {
      const errors = validatePreferences({
        ...validPreferences,
        maxArticles: -10,
        retentionDays: -5,
        retentionCount: -1,
      });

      expect(errors.maxArticles).toBeDefined();
      expect(errors.retentionDays).toBeDefined();
      expect(errors.retentionCount).toBeDefined();
    });

    it("should validate decimal numbers", () => {
      const errors = validatePreferences({
        ...validPreferences,
        maxArticles: 50.5,
        retentionDays: 30.7,
        retentionCount: 100.1,
      });

      // Decimals within range should be valid
      expect(errors.maxArticles).toBeUndefined();
      expect(errors.retentionDays).toBeUndefined();
      expect(errors.retentionCount).toBeUndefined();
    });
  });

  describe("clampNumericValue", () => {
    it("should clamp values below minimum", () => {
      expect(clampNumericValue(5, 10, 100)).toBe(10);
      expect(clampNumericValue(-10, 0, 100)).toBe(0);
      expect(clampNumericValue(0, 1, 365)).toBe(1);
    });

    it("should clamp values above maximum", () => {
      expect(clampNumericValue(150, 10, 100)).toBe(100);
      expect(clampNumericValue(10000, 10, 5000)).toBe(5000);
      expect(clampNumericValue(500, 1, 365)).toBe(365);
    });

    it("should not modify values within range", () => {
      expect(clampNumericValue(50, 10, 100)).toBe(50);
      expect(clampNumericValue(10, 10, 100)).toBe(10);
      expect(clampNumericValue(100, 10, 100)).toBe(100);
    });

    it("should handle edge cases", () => {
      expect(clampNumericValue(NaN, 10, 100)).toBe(10);
      expect(clampNumericValue(Infinity, 10, 100)).toBe(100);
      expect(clampNumericValue(-Infinity, 10, 100)).toBe(10);
    });

    it("should handle decimal values", () => {
      expect(clampNumericValue(5.5, 10, 100)).toBe(10);
      expect(clampNumericValue(50.5, 10, 100)).toBe(50.5);
      expect(clampNumericValue(150.5, 10, 100)).toBe(100);
    });
  });

  describe("validateTimeFormat", () => {
    it("should validate correct time formats", () => {
      expect(validateTimeFormat("00:00")).toBe(true);
      expect(validateTimeFormat("09:30")).toBe(true);
      expect(validateTimeFormat("12:00")).toBe(true);
      expect(validateTimeFormat("23:59")).toBe(true);
      expect(validateTimeFormat("15:45")).toBe(true);
    });

    it("should reject invalid hour values", () => {
      expect(validateTimeFormat("24:00")).toBe(false);
      expect(validateTimeFormat("25:30")).toBe(false);
      expect(validateTimeFormat("-1:00")).toBe(false);
    });

    it("should reject invalid minute values", () => {
      expect(validateTimeFormat("12:60")).toBe(false);
      expect(validateTimeFormat("12:61")).toBe(false);
      expect(validateTimeFormat("12:-1")).toBe(false);
    });

    it("should reject invalid formats", () => {
      expect(validateTimeFormat("12")).toBe(false);
      expect(validateTimeFormat("12:0")).toBe(false);
      expect(validateTimeFormat("1:00")).toBe(false);
      expect(validateTimeFormat("12:00:00")).toBe(false);
      expect(validateTimeFormat("noon")).toBe(false);
      expect(validateTimeFormat("")).toBe(false);
    });

    it("should handle null values", () => {
      expect(validateTimeFormat(null as any)).toBe(false);
      expect(validateTimeFormat(undefined as any)).toBe(false);
    });
  });

  describe("PREFERENCES_CONSTRAINTS", () => {
    it("should have correct constraint values", () => {
      expect(PREFERENCES_CONSTRAINTS.maxArticles.min).toBe(10);
      expect(PREFERENCES_CONSTRAINTS.maxArticles.max).toBe(5000);
      expect(PREFERENCES_CONSTRAINTS.retentionDays.min).toBe(1);
      expect(PREFERENCES_CONSTRAINTS.retentionDays.max).toBe(365);
      expect(PREFERENCES_CONSTRAINTS.retentionCount.min).toBe(1);
      expect(PREFERENCES_CONSTRAINTS.retentionCount.max).toBe(365);
    });

    it("should have valid theme options", () => {
      expect(PREFERENCES_CONSTRAINTS.theme).toEqual([
        "system",
        "light",
        "dark",
      ]);
    });

    it("should have valid feedOrder options", () => {
      expect(PREFERENCES_CONSTRAINTS.feedOrder).toEqual([
        "alphabetical",
        "recent",
        "unread",
      ]);
    });
  });

  describe("Complex validation scenarios", () => {
    it("should validate preferences with all fields at minimum values", () => {
      const minPreferences = {
        ...validPreferences,
        maxArticles: 10,
        retentionDays: 1,
        retentionCount: 1,
      };

      const errors = validatePreferences(minPreferences);
      expect(errors).toEqual({});
    });

    it("should validate preferences with all fields at maximum values", () => {
      const maxPreferences = {
        ...validPreferences,
        maxArticles: 5000,
        retentionDays: 365,
        retentionCount: 365,
      };

      const errors = validatePreferences(maxPreferences);
      expect(errors).toEqual({});
    });

    it("should handle preferences with notifications enabled", () => {
      const notificationPrefs = {
        ...validPreferences,
        enableNotifications: true,
        notificationTime: "09:00",
      };

      const errors = validatePreferences(notificationPrefs);
      expect(errors).toEqual({});

      // Invalid time with notifications enabled
      const invalidNotificationPrefs = {
        ...validPreferences,
        enableNotifications: true,
        notificationTime: "25:00",
      };

      const errorsWithInvalid = validatePreferences(invalidNotificationPrefs);
      expect(errorsWithInvalid.notificationTime).toBeDefined();
    });

    it("should handle type coercion attempts", () => {
      const coercedPreferences = {
        ...validPreferences,
        maxArticles: "100" as any, // String instead of number
        syncEnabled: "true" as any, // String instead of boolean
        theme: 123 as any, // Number instead of string
      };

      const errors = validatePreferences(coercedPreferences);
      // These should fail validation as they're wrong types
      expect(Object.keys(errors).length).toBeGreaterThan(0);
    });
  });
});
