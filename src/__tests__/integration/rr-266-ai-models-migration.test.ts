import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getAdminClient } from "@/lib/db/supabase-admin";

/**
 * RR-266: Integration tests for ai_models table migration
 * Tests the database schema for AI model metadata storage
 *
 * Test Contracts:
 * - Table creation with correct schema
 * - Seed data integrity (5 Claude models)
 * - RLS policies for public read access
 * - UNIQUE constraint on model_id
 */
describe("RR-266: AI Models Table Migration", () => {
  const supabase = getAdminClient();

  describe("Table Schema Validation", () => {
    it("should have ai_models table created", async () => {
      const { data, error } = await supabase
        .from("ai_models")
        .select("*")
        .limit(0); // Just check table exists

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it("should have correct column structure for ai_models", async () => {
      // Query table structure
      const { data, error } = await supabase
        .from("ai_models")
        .select("*")
        .limit(1);

      if (data && data.length > 0) {
        const model = data[0];

        // Verify all required columns exist
        expect(model).toHaveProperty("id");
        expect(model).toHaveProperty("model_id");
        expect(model).toHaveProperty("name");
        expect(model).toHaveProperty("description");
        expect(model).toHaveProperty("created_at");

        // Verify column types
        expect(typeof model.id).toBe("string"); // UUID as string
        expect(typeof model.model_id).toBe("string");
        expect(typeof model.name).toBe("string");
        expect(
          model.description === null || typeof model.description === "string"
        ).toBe(true);
        expect(typeof model.created_at).toBe("string"); // Timestamp as string

        // Verify UUID format
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(model.id).toMatch(uuidRegex);

        // Verify timestamp format
        expect(new Date(model.created_at)).toBeInstanceOf(Date);
      }
    });
  });

  describe("Seed Data Validation", () => {
    it("should seed exactly 5 Claude models", async () => {
      const { data, error } = await supabase
        .from("ai_models")
        .select("*")
        .order("created_at", { ascending: true });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBe(5);
    });

    it("should have correct model_id values for all seeded models", async () => {
      const expectedModelIds = [
        "claude-opus-4-1",
        "claude-opus-4-0",
        "claude-sonnet-4-0",
        "claude-3-7-sonnet-latest",
        "claude-3-5-haiku-latest",
      ];

      const { data, error } = await supabase
        .from("ai_models")
        .select("model_id")
        .order("model_id", { ascending: true });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      const actualModelIds = data?.map((m) => m.model_id).sort();
      expect(actualModelIds).toEqual(expectedModelIds.sort());
    });

    it("should have correct metadata for each seeded model", async () => {
      const expectedModels = [
        {
          model_id: "claude-opus-4-1",
          name: "Claude Opus 4.1",
          description: "Most capable model for complex tasks",
        },
        {
          model_id: "claude-opus-4-0",
          name: "Claude Opus 4.0",
          description: "Previous Opus version",
        },
        {
          model_id: "claude-sonnet-4-0",
          name: "Claude Sonnet 4.0",
          description: "Balanced performance and speed",
        },
        {
          model_id: "claude-3-7-sonnet-latest",
          name: "Claude 3.7 Sonnet",
          description: "Latest Sonnet 3.7 model",
        },
        {
          model_id: "claude-3-5-haiku-latest",
          name: "Claude 3.5 Haiku",
          description: "Fast and efficient",
        },
      ];

      for (const expected of expectedModels) {
        const { data, error } = await supabase
          .from("ai_models")
          .select("*")
          .eq("model_id", expected.model_id)
          .single();

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data?.name).toBe(expected.name);
        expect(data?.description).toBe(expected.description);
      }
    });
  });

  describe("Constraint Validation", () => {
    it("should enforce UNIQUE constraint on model_id", async () => {
      // Try to insert a duplicate model_id (using a seeded value)
      const duplicateModel = {
        model_id: "claude-opus-4-1", // Already exists from seed
        name: "Duplicate Model",
        description: "This should fail",
      };

      const { error } = await supabase.from("ai_models").insert(duplicateModel);

      expect(error).toBeDefined();
      expect(error?.code).toBe("23505"); // PostgreSQL unique constraint violation
    });

    it("should not allow NULL model_id", async () => {
      const invalidModel = {
        model_id: null,
        name: "Invalid Model",
        description: "Missing model_id",
      };

      const { error } = await supabase
        .from("ai_models")
        .insert(invalidModel as any);

      expect(error).toBeDefined();
      // PostgreSQL NOT NULL constraint violation or type validation error
      expect(error?.code === "23502" || error?.code === "PGRST204").toBe(true);
    });

    it("should not allow NULL name", async () => {
      const invalidModel = {
        model_id: "test-null-name",
        name: null,
        description: "Missing name",
      };

      const { error } = await supabase
        .from("ai_models")
        .insert(invalidModel as any);

      expect(error).toBeDefined();
      // PostgreSQL NOT NULL constraint violation or type validation error
      expect(error?.code === "23502" || error?.code === "PGRST204").toBe(true);

      // Clean up in case it somehow succeeded
      await supabase
        .from("ai_models")
        .delete()
        .eq("model_id", "test-null-name");
    });

    it("should allow NULL description", async () => {
      const validModel = {
        model_id: "test-null-description",
        name: "Test Model",
        description: null,
      };

      const { data, error } = await supabase
        .from("ai_models")
        .insert(validModel)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.description).toBeNull();

      // Clean up
      await supabase
        .from("ai_models")
        .delete()
        .eq("model_id", "test-null-description");
    });
  });

  describe("RLS Policy Validation", () => {
    it("should allow public read access to ai_models", async () => {
      // Note: In a real test environment, you'd test with an anonymous client
      // For now, we verify that reads work without user context
      const { data, error } = await supabase
        .from("ai_models")
        .select("model_id, name")
        .limit(5);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThan(0);
    });

    it("should return all models when queried without filters", async () => {
      const { data, error } = await supabase.from("ai_models").select("*");

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBe(5); // All 5 seeded models
    });
  });

  describe("Default Value Validation", () => {
    it("should auto-generate UUID for id field", async () => {
      const testModel = {
        model_id: "test-uuid-generation",
        name: "UUID Test Model",
        description: "Testing UUID generation",
      };

      const { data, error } = await supabase
        .from("ai_models")
        .insert(testModel)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBeDefined();

      // Verify UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(data?.id).toMatch(uuidRegex);

      // Clean up
      await supabase
        .from("ai_models")
        .delete()
        .eq("model_id", "test-uuid-generation");
    });

    it("should auto-generate created_at timestamp", async () => {
      const beforeInsert = new Date();

      const testModel = {
        model_id: "test-timestamp",
        name: "Timestamp Test Model",
        description: "Testing timestamp generation",
      };

      const { data, error } = await supabase
        .from("ai_models")
        .insert(testModel)
        .select()
        .single();

      const afterInsert = new Date();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.created_at).toBeDefined();

      const createdAt = new Date(data?.created_at);
      expect(createdAt).toBeInstanceOf(Date);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeInsert.getTime()
      );
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterInsert.getTime());

      // Clean up
      await supabase
        .from("ai_models")
        .delete()
        .eq("model_id", "test-timestamp");
    });
  });

  describe("Query Performance", () => {
    it("should efficiently query models by model_id", async () => {
      const startTime = Date.now();

      const { data, error } = await supabase
        .from("ai_models")
        .select("*")
        .eq("model_id", "claude-opus-4-1")
        .single();

      const queryTime = Date.now() - startTime;

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.model_id).toBe("claude-opus-4-1");
      expect(queryTime).toBeLessThan(100); // Should be fast with UNIQUE index
    });

    it("should efficiently retrieve all models", async () => {
      const startTime = Date.now();

      const { data, error } = await supabase
        .from("ai_models")
        .select("*")
        .order("created_at", { ascending: true });

      const queryTime = Date.now() - startTime;

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBe(5);
      expect(queryTime).toBeLessThan(100); // Should be fast for small dataset
    });
  });

  describe("Data Integrity", () => {
    it("should maintain data integrity across CRUD operations", async () => {
      // Insert
      const testModel = {
        model_id: "test-crud",
        name: "CRUD Test Model",
        description: "Testing CRUD operations",
      };

      const { data: insertData, error: insertError } = await supabase
        .from("ai_models")
        .insert(testModel)
        .select()
        .single();

      expect(insertError).toBeNull();
      expect(insertData).toBeDefined();
      const insertedId = insertData?.id;

      // Read
      const { data: readData, error: readError } = await supabase
        .from("ai_models")
        .select("*")
        .eq("id", insertedId)
        .single();

      expect(readError).toBeNull();
      expect(readData?.model_id).toBe(testModel.model_id);
      expect(readData?.name).toBe(testModel.name);
      expect(readData?.description).toBe(testModel.description);

      // Update
      const updatedName = "Updated CRUD Test Model";
      const { error: updateError } = await supabase
        .from("ai_models")
        .update({ name: updatedName })
        .eq("id", insertedId);

      expect(updateError).toBeNull();

      // Verify update
      const { data: verifyData, error: verifyError } = await supabase
        .from("ai_models")
        .select("name")
        .eq("id", insertedId)
        .single();

      expect(verifyError).toBeNull();
      expect(verifyData?.name).toBe(updatedName);

      // Delete
      const { error: deleteError } = await supabase
        .from("ai_models")
        .delete()
        .eq("id", insertedId);

      expect(deleteError).toBeNull();

      // Verify deletion
      const { data: deletedData, error: deletedError } = await supabase
        .from("ai_models")
        .select("*")
        .eq("id", insertedId)
        .single();

      // Should return no data
      expect(deletedData).toBeNull();
    });

    it("should preserve seed data integrity", async () => {
      // Verify all 5 seeded models still exist unchanged
      const { data, error } = await supabase
        .from("ai_models")
        .select("*")
        .in("model_id", [
          "claude-opus-4-1",
          "claude-opus-4-0",
          "claude-sonnet-4-0",
          "claude-3-7-sonnet-latest",
          "claude-3-5-haiku-latest",
        ])
        .order("model_id", { ascending: true });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBe(5);

      // All seeded models should still have their original data
      const opus41 = data?.find((m) => m.model_id === "claude-opus-4-1");
      expect(opus41?.name).toBe("Claude Opus 4.1");
      expect(opus41?.description).toBe("Most capable model for complex tasks");
    });
  });
});
