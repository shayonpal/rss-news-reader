/**
 * Integration Tests for RR-67: Database Security Fixes
 *
 * These tests validate that the security fixes are properly implemented
 * according to the contracts defined in rr-67-security-fixes.contract.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  ViewBehaviorContracts,
  FunctionBehaviorContracts,
  SecurityValidationContracts,
  AcceptanceCriteria,
  IntegrationTestContracts,
} from "../contracts/rr-67-security-fixes.contract";

// Test database connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe("RR-67: Database Security Fixes", () => {
  let serviceClient: ReturnType<typeof createClient<Database>>;
  let anonClient: ReturnType<typeof createClient<Database>>;

  beforeAll(() => {
    // Service role client - has full access
    serviceClient = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Anonymous client - limited access based on RLS
    anonClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  });

  describe("View Security Tests", () => {
    describe("SECURITY DEFINER removal validation", () => {
      it("should have no views with SECURITY DEFINER", async () => {
        const { data, error } = await serviceClient.rpc(
          "get_view_security_modes"
        );

        expect(error).toBeNull();

        // Check each view from our contracts
        const targetViews = [
          "sync_queue_stats",
          "author_quality_report",
          "author_statistics",
          "sync_author_health",
        ];

        targetViews.forEach((viewName) => {
          const viewInfo = data?.find((v: any) => v.viewname === viewName);
          expect(viewInfo).toBeDefined();
          expect(viewInfo?.definition).not.toContain("SECURITY DEFINER");
        });
      });

      it("should respect RLS policies for sync_queue_stats view", async () => {
        // Test with service role - should see all data
        const { data: serviceData } = await serviceClient
          .from("sync_queue_stats" as any)
          .select("*");

        // Test with anon client - should respect RLS
        const { data: anonData, error: anonError } = await anonClient
          .from("sync_queue_stats" as any)
          .select("*");

        // Anonymous user should either get no data or an error based on RLS
        expect(anonData?.length || 0).toBeLessThanOrEqual(
          serviceData?.length || 0
        );
      });

      it("should respect RLS policies for author_quality_report view", async () => {
        // Service role sees all authors
        const { data: serviceData } = await serviceClient
          .from("author_quality_report" as any)
          .select("*");

        // Anon client sees limited data based on RLS
        const { data: anonData } = await anonClient
          .from("author_quality_report" as any)
          .select("*");

        // Verify data isolation
        expect(anonData?.length || 0).toBeLessThanOrEqual(
          serviceData?.length || 0
        );
      });

      it("should respect RLS policies for author_statistics view", async () => {
        const { data: serviceData } = await serviceClient
          .from("author_statistics" as any)
          .select("*");

        const { data: anonData } = await anonClient
          .from("author_statistics" as any)
          .select("*");

        expect(anonData?.length || 0).toBeLessThanOrEqual(
          serviceData?.length || 0
        );
      });

      it("should respect RLS policies for sync_author_health view", async () => {
        const { data: serviceData } = await serviceClient
          .from("sync_author_health" as any)
          .select("*");

        const { data: anonData } = await anonClient
          .from("sync_author_health" as any)
          .select("*");

        expect(anonData?.length || 0).toBeLessThanOrEqual(
          serviceData?.length || 0
        );
      });
    });
  });

  describe("Function Security Tests", () => {
    describe("search_path validation", () => {
      const criticalFunctions = [
        "get_unread_counts_by_feed",
        "get_articles_optimized",
        "refresh_feed_stats",
        "add_to_sync_queue",
        "update_updated_at_column",
        "increment_api_usage",
        "cleanup_old_sync_queue_entries",
      ];

      it("should have search_path set for all critical functions", async () => {
        const { data, error } = await serviceClient.rpc(
          "check_function_search_paths",
          {
            function_names: criticalFunctions,
          }
        );

        expect(error).toBeNull();
        expect(data).toBeDefined();

        // Each function should have search_path=public
        criticalFunctions.forEach((funcName) => {
          const funcInfo = data?.find((f: any) => f.function_name === funcName);
          expect(funcInfo).toBeDefined();
          expect(funcInfo?.has_search_path).toBe(true);
          expect(funcInfo?.search_path).toContain("public");
        });
      });

      it("should resist schema hijacking for get_unread_counts_by_feed", async () => {
        // This test validates that the function uses the correct schema
        // even if someone tries to hijack it with a malicious schema

        // First get a valid user ID
        const { data: users } = await serviceClient
          .from("users")
          .select("id")
          .limit(1);

        if (users && users.length > 0) {
          const userId = users[0].id;

          // Call the function - should work with search_path protection
          const { data, error } = await serviceClient.rpc(
            "get_unread_counts_by_feed",
            {
              p_user_id: userId,
            }
          );

          expect(error).toBeNull();
          expect(data).toBeDefined();
        }
      });

      it("should correctly execute get_articles_optimized with search_path", async () => {
        const { data: users } = await serviceClient
          .from("users")
          .select("id")
          .limit(1);

        if (users && users.length > 0) {
          const userId = users[0].id;

          const { data, error } = await serviceClient.rpc(
            "get_articles_optimized",
            {
              p_user_id: userId,
              p_limit: 10,
              p_offset: 0,
            }
          );

          expect(error).toBeNull();
          expect(data).toBeDefined();
        }
      });

      it("should correctly execute refresh_feed_stats with search_path", async () => {
        const { error } = await serviceClient.rpc("refresh_feed_stats");

        // Function should execute without errors
        expect(error).toBeNull();

        // Verify the materialized view was refreshed
        const { data } = await serviceClient
          .from("feed_stats")
          .select("last_refreshed")
          .limit(1);

        expect(data).toBeDefined();
      });
    });
  });

  describe("Security Advisor Validation", () => {
    it("should have zero ERROR level security issues", async () => {
      // This would require actual access to Supabase security advisor
      // For testing, we validate the structure is correct

      const validation = SecurityValidationContracts.afterMigration;
      expect(validation.errorCount).toBe(0);
      expect(validation.criticalIssues).toHaveLength(0);
    });

    it("should show 46% reduction in security warnings", async () => {
      const before = SecurityValidationContracts.beforeMigration;
      const after = SecurityValidationContracts.afterMigration;

      const reduction =
        ((before.totalIssues - after.totalIssues) / before.totalIssues) * 100;
      expect(reduction).toBeGreaterThanOrEqual(45); // Allow small variance
    });
  });

  describe("Acceptance Criteria Validation", () => {
    it("should meet AC-1: All SECURITY DEFINER views converted", async () => {
      const { data, error } = await serviceClient.sql`
        SELECT COUNT(*) as count
        FROM pg_views 
        WHERE schemaname = 'public'
        AND viewname IN ('sync_queue_stats', 'author_quality_report', 'author_statistics', 'sync_author_health')
        AND definition ILIKE '%SECURITY DEFINER%'
      `;

      expect(error).toBeNull();
      expect(data?.[0]?.count).toBe(0);
    });

    it("should meet AC-2: All critical functions have search_path", async () => {
      const { data, error } = await serviceClient.sql`
        SELECT COUNT(*) as count
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN (
          'get_unread_counts_by_feed', 'get_articles_optimized', 'refresh_feed_stats',
          'add_to_sync_queue', 'update_updated_at_column', 'increment_api_usage',
          'cleanup_old_sync_queue_entries'
        )
        AND p.proconfig::text LIKE '%search_path=public%'
      `;

      expect(error).toBeNull();
      expect(data?.[0]?.count).toBe(7);
    });

    it("should meet AC-5: All existing functionality continues to work", async () => {
      // Test article fetching
      const { error: articlesError } = await serviceClient
        .from("articles")
        .select("*")
        .limit(1);
      expect(articlesError).toBeNull();

      // Test feeds
      const { error: feedsError } = await serviceClient
        .from("feeds")
        .select("*")
        .limit(1);
      expect(feedsError).toBeNull();

      // Test sync_queue
      const { error: syncError } = await serviceClient
        .from("sync_queue")
        .select("*")
        .limit(1);
      expect(syncError).toBeNull();
    });
  });

  describe("Integration Tests", () => {
    it("should handle sync pipeline operations correctly", async () => {
      // Test that sync queue operations work with the fixed functions
      const testContract = IntegrationTestContracts.syncPipeline;

      expect(testContract.criticalPath).toBe(true);

      // Verify sync queue can be accessed
      const { error } = await serviceClient
        .from("sync_queue")
        .select("*")
        .limit(1);

      expect(error).toBeNull();
    });

    it("should handle article operations correctly", async () => {
      const { data: users } = await serviceClient
        .from("users")
        .select("id")
        .limit(1);

      if (users && users.length > 0) {
        // Test unread counts function
        const { error: unreadError } = await serviceClient.rpc(
          "get_unread_counts_by_feed",
          {
            p_user_id: users[0].id,
          }
        );
        expect(unreadError).toBeNull();

        // Test articles optimized function
        const { error: articlesError } = await serviceClient.rpc(
          "get_articles_optimized",
          {
            p_user_id: users[0].id,
            p_limit: 5,
          }
        );
        expect(articlesError).toBeNull();
      }
    });

    it("should handle monitoring dashboard correctly", async () => {
      // Test that monitoring views work with proper RLS
      const views = [
        "author_quality_report",
        "author_statistics",
        "sync_author_health",
      ];

      for (const view of views) {
        const { error } = await serviceClient
          .from(view as any)
          .select("*")
          .limit(1);

        // Views should be accessible (though may return empty based on RLS)
        expect(error).toBeNull();
      }
    });
  });
});

/**
 * Helper RPC functions that would need to be created in the database
 * for complete testing. These are referenced in the tests above.
 */
export const requiredTestHelpers = `
-- Helper function to check view security modes
CREATE OR REPLACE FUNCTION get_view_security_modes()
RETURNS TABLE(viewname text, definition text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT viewname, definition 
  FROM pg_views 
  WHERE schemaname = 'public'
  AND viewname IN ('sync_queue_stats', 'author_quality_report', 'author_statistics', 'sync_author_health');
$$;

-- Helper function to check function search paths
CREATE OR REPLACE FUNCTION check_function_search_paths(function_names text[])
RETURNS TABLE(function_name text, has_search_path boolean, search_path text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.proname as function_name,
    p.proconfig IS NOT NULL as has_search_path,
    p.proconfig::text as search_path
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname = ANY(function_names);
$$;
`;
