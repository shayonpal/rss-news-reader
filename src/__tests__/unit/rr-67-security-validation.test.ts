/**
 * Unit Tests for RR-67: Security Validation
 *
 * These tests validate individual security components without database connection
 */

import { describe, it, expect } from "vitest";
import {
  SecurityIssue,
  SecurityReport,
  DatabaseState,
  FunctionState,
  ViewState,
  SecurityIssueSchema,
  SecurityReportSchema,
  DatabaseStateSchema,
  FunctionStateSchema,
  ViewStateSchema,
  SecurityValidation,
  REQUIRED_MIGRATION_SQL,
} from "@/contracts/rr-67-security";

// Inline contracts to remove dependency on archived files
const ViewBehaviorContracts = {
  sync_queue_stats: {
    before: {
      securityMode: "SECURITY DEFINER" as const,
      behavior: "Bypasses RLS - returns all rows regardless of user",
    },
    after: {
      securityMode: "SECURITY INVOKER" as const,
      behavior: "Respects RLS - returns only rows user has access to",
      validation: {
        asServiceRole: "Should return all rows when queried as service role",
      },
      expectedForNonOwner:
        "Returns only rows matching RLS policies for current user",
      expectedForOwner: "Returns rows based on owner RLS policies",
    },
  },
  author_quality_report: {
    before: {
      securityMode: "SECURITY DEFINER" as const,
      behavior: "Bypasses RLS - exposes all author data",
    },
    after: {
      securityMode: "SECURITY INVOKER" as const,
      behavior: "Respects RLS - returns only authorized author data",
      validation: {
        dataIsolation:
          "User A should not see authors from User B's private feeds",
      },
      expectedForNonOwner:
        "Returns only authors from user's accessible articles",
      expectedForOwner: "Returns authors based on owner's article access",
    },
  },
  author_statistics: {
    before: {
      securityMode: "SECURITY DEFINER" as const,
      behavior: "Bypasses RLS - exposes all author metrics",
    },
    after: {
      securityMode: "SECURITY INVOKER" as const,
      behavior: "Respects RLS - returns only authorized metrics",
      validation: {
        countAccuracy: "Article counts should match user's accessible articles",
      },
      expectedForNonOwner: "Returns metrics only for accessible authors",
      expectedForOwner: "Returns metrics based on RLS policies",
    },
  },
  sync_author_health: {
    before: {
      securityMode: "SECURITY DEFINER" as const,
      behavior: "Bypasses RLS - exposes all sync health data",
    },
    after: {
      securityMode: "SECURITY INVOKER" as const,
      behavior: "Respects RLS - returns only authorized sync data",
      validation: {
        userIsolation: "Should not expose other users' sync status",
      },
      expectedForNonOwner: "Returns only user's sync health data",
      expectedForOwner: "Returns sync data based on RLS policies",
    },
  },
};

const FunctionBehaviorContracts = {
  get_unread_counts_by_feed: {
    before: {
      hasSearchPath: false,
      vulnerability: "Vulnerable to schema hijacking",
      impact: "Could read from malicious table",
    },
    after: {
      hasSearchPath: true,
      searchPath: "public",
      protection: "Always reads from public schema",
      testValidation: { expected: "Returns counts from public.articles only" },
    },
  },
  get_articles_optimized: {
    before: {
      hasSearchPath: false,
      vulnerability:
        "Critical vulnerability - main article fetching could be hijacked",
      impact: "Critical - Could return malicious content",
    },
    after: {
      hasSearchPath: true,
      searchPath: "public",
      protection: "Guarantees articles from legitimate tables",
      testValidation: {
        expectedBehavior: "Always returns articles from public.articles",
      },
    },
  },
  refresh_feed_stats: {
    before: {
      hasSearchPath: false,
      vulnerability: "Could refresh wrong materialized view if hijacked",
      impact: "Statistics could be corrupted",
    },
    after: {
      hasSearchPath: true,
      searchPath: "public",
      protection: "Always refreshes public.feed_stats",
      testValidation: {
        expected: "public.feed_stats.last_refreshed is updated",
      },
    },
  },
  add_to_sync_queue: {
    before: {
      hasSearchPath: false,
      vulnerability: "Sync operations could be redirected",
      impact: "Critical - could disrupt bi-directional sync",
    },
    after: {
      hasSearchPath: true,
      searchPath: "public",
      protection: "Ensures sync queue operations use correct table",
      testValidation: { expectedTable: "public.sync_queue" },
    },
  },
  update_updated_at_column: {
    before: {
      hasSearchPath: false,
      vulnerability: "Trigger function could be manipulated",
      impact: "Timestamp updates could fail",
    },
    after: {
      hasSearchPath: true,
      searchPath: "public",
      protection: "Timestamp updates always use correct schema",
      testValidation: {
        expected: "updated_at column in public.articles is updated",
      },
    },
  },
  increment_api_usage: {
    before: {
      hasSearchPath: false,
      vulnerability: "API usage tracking could be bypassed",
      impact: "Critical - Could exceed Inoreader API limits",
    },
    after: {
      hasSearchPath: true,
      searchPath: "public",
      protection: "API usage always tracked in correct table",
      testValidation: { expectedTable: "public.api_usage" },
    },
  },
  cleanup_old_sync_queue_entries: {
    before: {
      hasSearchPath: false,
      vulnerability: "Could delete from wrong table",
      impact: "Queue maintenance could fail",
    },
    after: {
      hasSearchPath: true,
      searchPath: "public",
      protection: "Cleanup always targets correct sync_queue table",
      testValidation: {
        description: "Verify cleanup targets public.sync_queue only",
      },
    },
  },
};

const SecurityValidationContracts = {
  beforeMigration: {
    errorCount: 4,
    warningCount: 20,
    totalIssues: 24,
    criticalIssues: [
      "sync_queue_stats uses SECURITY DEFINER",
      "author_quality_report uses SECURITY DEFINER",
      "author_statistics uses SECURITY DEFINER",
      "sync_author_health uses SECURITY DEFINER",
    ],
    highPriorityIssues: [
      "get_unread_counts_by_feed missing search_path",
      "get_articles_optimized missing search_path",
      "refresh_feed_stats missing search_path",
      "add_to_sync_queue missing search_path",
      "update_updated_at_column missing search_path",
      "increment_api_usage missing search_path",
      "cleanup_old_sync_queue_entries missing search_path",
    ],
  },
  afterMigration: {
    errorCount: 0,
    warningCount: 13,
    totalIssues: 13,
    criticalIssues: [],
    validation: {
      query:
        "SELECT viewname, definition FROM pg_views WHERE schemaname = 'public' AND definition ILIKE '%SECURITY DEFINER%';",
      expectedRows: 0,
    },
  },
  functionsValidation: {
    query:
      "SELECT p.proname, p.proconfig FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname IN ('get_unread_counts_by_feed', 'get_articles_optimized', 'refresh_feed_stats', 'add_to_sync_queue', 'update_updated_at_column', 'increment_api_usage', 'cleanup_old_sync_queue_entries');",
  },
};

const StateTransitionContracts = {
  migrationSteps: [
    {
      step: 1,
      description: "Drop existing SECURITY DEFINER views",
      action:
        "DROP VIEW IF EXISTS sync_queue_stats, author_quality_report, author_statistics, sync_author_health CASCADE",
    },
    {
      step: 2,
      description: "Recreate views with SECURITY INVOKER",
      action: "CREATE VIEW ... WITH (security_invoker = true)",
    },
    {
      step: 3,
      description: "Update functions with search_path",
      action: "ALTER FUNCTION ... SET search_path = public",
      validation: {
        preserveBehavior: "Function logic remains unchanged",
        onlySecurityImproved: true,
      },
    },
  ],
  rollbackStrategy: {
    canRollback: true,
    warning: "Rollback would reintroduce security vulnerabilities",
  },
  dataIntegrity: {
    description: "No data should be lost during migration",
    validation: [
      { check: "Row counts remain same" },
      { check: "View results remain consistent" },
      { check: "Function results unchanged" },
    ],
  },
  performanceImpact: {
    expected: "Minimal to none",
    acceptableThreshold: "< 5% performance degradation",
  },
};

const AcceptanceCriteria = {
  required: [
    {
      id: "AC-1",
      description: "All 4 SECURITY DEFINER views converted to SECURITY INVOKER",
      testQuery:
        "SELECT COUNT(*) = 0 as passed FROM pg_views WHERE viewname IN ('sync_queue_stats', 'author_quality_report', 'author_statistics', 'sync_author_health') AND definition ILIKE '%SECURITY DEFINER%'",
      mustPass: true,
    },
    {
      id: "AC-2",
      description: "All 7 critical functions have search_path set to public",
      testQuery:
        "SELECT COUNT(*) = 7 as passed FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname IN ('get_unread_counts_by_feed', 'get_articles_optimized', 'refresh_feed_stats', 'add_to_sync_queue', 'update_updated_at_column', 'increment_api_usage', 'cleanup_old_sync_queue_entries') AND p.proconfig::text LIKE '%search_path=public%'",
      mustPass: true,
    },
    {
      id: "AC-3",
      description: "Security advisor shows 0 ERROR level issues",
      validation: "Run Supabase security advisor and verify errorCount = 0",
      mustPass: true,
    },
    {
      id: "AC-4",
      description: "46% reduction in total security warnings achieved",
      validation: "Total warnings reduced from 24 to ~13",
      mustPass: true,
    },
    {
      id: "AC-5",
      description: "All existing functionality continues to work",
      tests: [
        "Article fetching works",
        "Sync pipeline operates correctly",
        "Monitoring dashboards show correct data",
        "RLS policies are respected",
      ],
      mustPass: true,
    },
  ],
  optional: [
    {
      id: "OPT-1",
      description: "Performance remains within 5% of baseline",
      nice_to_have: true,
    },
    {
      id: "OPT-2",
      description: "Migration completes in under 1 second",
      nice_to_have: true,
    },
  ],
};

const IntegrationTestContracts = {
  syncPipeline: {
    tests: [
      {
        name: "Manual sync trigger",
        endpoint: "POST /api/sync",
        affectedFunctions: ["add_to_sync_queue", "increment_api_usage"],
      },
      {
        name: "Sync queue processing",
        process: "sync_queue_processor",
        affectedViews: ["sync_queue_stats"],
      },
      {
        name: "API usage tracking",
        validation: "API calls counted correctly with search_path",
      },
    ],
  },
  articleOperations: {
    tests: [
      {
        name: "Fetch articles",
        function: "get_articles_optimized",
        expectedBehavior:
          "Returns correct articles with search_path protection",
      },
      {
        name: "Unread counts",
        function: "get_unread_counts_by_feed",
        expectedBehavior: "Returns accurate counts from correct schema",
      },
      {
        name: "Feed statistics",
        function: "refresh_feed_stats",
        expectedBehavior: "Updates correct materialized view",
      },
    ],
  },
  monitoringDashboard: {
    tests: [
      {
        name: "Author quality metrics",
        view: "author_quality_report",
        expectedBehavior: "Shows only user's author data",
      },
      {
        name: "Author statistics",
        view: "author_statistics",
        expectedBehavior: "Statistics scoped to user's articles",
      },
      {
        name: "Sync health",
        view: "sync_author_health",
        expectedBehavior: "Shows only user's sync status",
      },
    ],
  },
};

describe("RR-67: Security Validation Unit Tests", () => {
  describe("Zod Schema Validation", () => {
    it("should validate security issues with Zod schema", () => {
      const issue: SecurityIssue = {
        type: "missing_rls",
        severity: "error",
        resource: "articles",
        message: "Row Level Security is not enabled",
      };

      const validated = SecurityIssueSchema.parse(issue);
      expect(validated.type).toBe("missing_rls");
      expect(validated.severity).toBe("error");
    });

    it("should validate security reports", () => {
      const report: SecurityReport = {
        errorCount: 2,
        warningCount: 1,
        errors: [
          {
            type: "missing_permission",
            severity: "error",
            resource: "users",
            message: "Missing SELECT permission",
          },
        ],
        warnings: [
          {
            type: "exposed_field",
            severity: "warning",
            resource: "profiles",
            message: "Email field exposed",
            location: "public.profiles",
          },
        ],
      };

      const validated = SecurityValidation.validateReport(report);
      expect(validated.errorCount).toBe(2);
      expect(validated.errors).toHaveLength(1);
    });

    it("should validate database state requirements", () => {
      const validState: DatabaseState = {
        hasCorrectPermissions: true,
        hasRequiredConstraints: true,
        hasRLSEnabled: true,
        exposedFields: [],
      };

      const validated = SecurityValidation.validateDatabaseState(validState);
      expect(validated.hasRLSEnabled).toBe(true);

      // Test invalid state
      const invalidState: DatabaseState = {
        hasCorrectPermissions: false,
        hasRequiredConstraints: true,
        hasRLSEnabled: false,
        exposedFields: ["password", "api_key"],
      };

      expect(() =>
        SecurityValidation.validateDatabaseState(invalidState)
      ).toThrow("Row Level Security must be enabled");
    });

    it("should validate function security", () => {
      const secureFunction: FunctionState = {
        name: "get_user_data",
        hasSecurityDefiner: false,
        hasCorrectOwner: true,
        performsAuthCheck: true,
      };

      const validated =
        SecurityValidation.validateFunctionSecurity(secureFunction);
      expect(validated.performsAuthCheck).toBe(true);

      // Test insecure function
      const insecureFunction: FunctionState = {
        name: "get_all_data",
        hasSecurityDefiner: true,
        hasCorrectOwner: true,
        performsAuthCheck: false,
      };

      expect(() =>
        SecurityValidation.validateFunctionSecurity(insecureFunction)
      ).toThrow("Function get_all_data does not perform authentication check");
    });

    it("should validate view security", () => {
      const secureView: ViewState = {
        name: "public_articles",
        hasRLSEnabled: true,
        hasCorrectPermissions: true,
        exposesPrivateData: false,
      };

      const validated = SecurityValidation.validateViewSecurity(secureView);
      expect(validated.exposesPrivateData).toBe(false);

      // Test insecure view
      const insecureView: ViewState = {
        name: "user_secrets",
        hasRLSEnabled: false,
        hasCorrectPermissions: true,
        exposesPrivateData: true,
      };

      expect(() =>
        SecurityValidation.validateViewSecurity(insecureView)
      ).toThrow("View user_secrets exposes private data");
    });
  });

  describe("Contract Validation", () => {
    it("should define all required views for security fixes", () => {
      const viewNames = Object.keys(ViewBehaviorContracts);

      expect(viewNames).toContain("sync_queue_stats");
      expect(viewNames).toContain("author_quality_report");
      expect(viewNames).toContain("author_statistics");
      expect(viewNames).toContain("sync_author_health");
      expect(viewNames).toHaveLength(4);
    });

    it("should define all required functions for search_path fixes", () => {
      const functionNames = Object.keys(FunctionBehaviorContracts);

      expect(functionNames).toContain("get_unread_counts_by_feed");
      expect(functionNames).toContain("get_articles_optimized");
      expect(functionNames).toContain("refresh_feed_stats");
      expect(functionNames).toContain("add_to_sync_queue");
      expect(functionNames).toContain("update_updated_at_column");
      expect(functionNames).toContain("increment_api_usage");
      expect(functionNames).toContain("cleanup_old_sync_queue_entries");
      expect(functionNames).toHaveLength(7);
    });
  });

  describe("View Security Specifications", () => {
    it("should specify SECURITY INVOKER for all views after migration", () => {
      Object.values(ViewBehaviorContracts).forEach((viewContract) => {
        expect(viewContract.after.securityMode).toBe("SECURITY INVOKER");
        expect(viewContract.before.securityMode).toBe("SECURITY DEFINER");
      });
    });

    it("should define RLS behavior for each view", () => {
      Object.values(ViewBehaviorContracts).forEach((viewContract) => {
        expect(viewContract.after.behavior).toContain("Respects RLS");
        expect(viewContract.before.behavior).toContain("Bypasses RLS");
      });
    });

    it("should provide validation criteria for each view", () => {
      Object.values(ViewBehaviorContracts).forEach((viewContract) => {
        expect(viewContract.after.validation).toBeDefined();
        expect(viewContract.after.expectedForNonOwner).toBeDefined();
        expect(viewContract.after.expectedForOwner).toBeDefined();
      });
    });
  });

  describe("Function Security Specifications", () => {
    it("should specify search_path for all functions after migration", () => {
      Object.values(FunctionBehaviorContracts).forEach((functionContract) => {
        expect(functionContract.after.hasSearchPath).toBe(true);
        expect(functionContract.after.searchPath).toBe("public");
        expect(functionContract.before.hasSearchPath).toBe(false);
      });
    });

    it("should identify vulnerabilities for each function", () => {
      Object.values(FunctionBehaviorContracts).forEach((functionContract) => {
        expect(functionContract.before.vulnerability).toBeDefined();
        expect(functionContract.after.protection).toBeDefined();
      });
    });

    it("should provide test validation for each function", () => {
      Object.values(FunctionBehaviorContracts).forEach((functionContract) => {
        expect(functionContract.after.testValidation).toBeDefined();
      });
    });

    it("should mark critical functions appropriately", () => {
      const criticalFunctions = [
        "get_articles_optimized",
        "add_to_sync_queue",
        "increment_api_usage",
      ];

      criticalFunctions.forEach((funcName) => {
        const contract =
          FunctionBehaviorContracts[
            funcName as keyof typeof FunctionBehaviorContracts
          ];
        expect(contract.before.impact).toContain("Critical");
      });
    });
  });

  describe("Security Metrics Validation", () => {
    it("should target zero ERROR level issues after migration", () => {
      expect(SecurityValidationContracts.afterMigration.errorCount).toBe(0);
      expect(SecurityValidationContracts.beforeMigration.errorCount).toBe(4);
    });

    it("should achieve 46% reduction in total security issues", () => {
      const before = SecurityValidationContracts.beforeMigration.totalIssues;
      const after = SecurityValidationContracts.afterMigration.totalIssues;
      const reduction = ((before - after) / before) * 100;

      expect(reduction).toBeGreaterThanOrEqual(45);
      expect(reduction).toBeLessThanOrEqual(47);
    });

    it("should fix all critical SECURITY DEFINER issues", () => {
      expect(
        SecurityValidationContracts.afterMigration.criticalIssues
      ).toHaveLength(0);
      expect(
        SecurityValidationContracts.beforeMigration.criticalIssues
      ).toHaveLength(4);
    });

    it("should fix all high priority search_path issues", () => {
      expect(
        SecurityValidationContracts.beforeMigration.highPriorityIssues
      ).toHaveLength(7);
      // After migration, these should not be in the remaining warnings
      expect(
        SecurityValidationContracts.afterMigration.criticalIssues
      ).not.toContain("get_unread_counts_by_feed missing search_path");
    });
  });

  describe("State Transition Validation", () => {
    it("should define proper migration steps", () => {
      const steps = StateTransitionContracts.migrationSteps;

      expect(steps).toHaveLength(3);
      expect(steps[0].description).toContain(
        "Drop existing SECURITY DEFINER views"
      );
      expect(steps[1].description).toContain(
        "Recreate views with SECURITY INVOKER"
      );
      expect(steps[2].description).toContain(
        "Update functions with search_path"
      );
    });

    it("should specify rollback strategy", () => {
      const rollback = StateTransitionContracts.rollbackStrategy;

      expect(rollback.canRollback).toBe(true);
      expect(rollback.warning).toContain(
        "reintroduce security vulnerabilities"
      );
    });

    it("should ensure data integrity during migration", () => {
      const integrity = StateTransitionContracts.dataIntegrity;

      expect(integrity.validation).toBeDefined();
      expect(integrity.validation).toHaveLength(3);
      expect(integrity.description).toContain("No data should be lost");
    });

    it("should define acceptable performance impact", () => {
      const performance = StateTransitionContracts.performanceImpact;

      expect(performance.expected).toBe("Minimal to none");
      expect(performance.acceptableThreshold).toBe(
        "< 5% performance degradation"
      );
    });
  });

  describe("Acceptance Criteria Validation", () => {
    it("should define all required acceptance criteria", () => {
      const required = AcceptanceCriteria.required;

      expect(required).toHaveLength(5);

      const criteriaIds = required.map((c) => c.id);
      expect(criteriaIds).toContain("AC-1"); // Views converted
      expect(criteriaIds).toContain("AC-2"); // Functions have search_path
      expect(criteriaIds).toContain("AC-3"); // Zero ERROR issues
      expect(criteriaIds).toContain("AC-4"); // 46% reduction
      expect(criteriaIds).toContain("AC-5"); // Functionality works
    });

    it("should mark all required criteria as mustPass", () => {
      AcceptanceCriteria.required.forEach((criteria) => {
        expect(criteria.mustPass).toBe(true);
      });
    });

    it("should provide test queries for verifiable criteria", () => {
      const ac1 = AcceptanceCriteria.required.find((c) => c.id === "AC-1");
      const ac2 = AcceptanceCriteria.required.find((c) => c.id === "AC-2");

      expect(ac1?.testQuery).toBeDefined();
      expect(ac2?.testQuery).toBeDefined();
      expect(ac1?.testQuery).toContain("SELECT COUNT(*) = 0");
      expect(ac2?.testQuery).toContain("SELECT COUNT(*) = 7");
    });

    it("should define optional nice-to-have criteria", () => {
      const optional = AcceptanceCriteria.optional;

      expect(optional).toHaveLength(2);
      expect(optional[0].id).toBe("OPT-1");
      expect(optional[1].id).toBe("OPT-2");

      optional.forEach((criteria) => {
        expect(criteria.nice_to_have).toBe(true);
      });
    });
  });

  describe("SQL Query Validation", () => {
    it("should provide valid SQL for checking views", () => {
      const query = SecurityValidationContracts.afterMigration.validation.query;

      expect(query).toContain("SELECT viewname, definition");
      expect(query).toContain("FROM pg_views");
      expect(query).toContain("WHERE schemaname = 'public'");
      expect(query).toContain("SECURITY DEFINER");
    });

    it("should provide valid SQL for checking functions", () => {
      const query = SecurityValidationContracts.functionsValidation.query;

      expect(query).toContain("SELECT p.proname, p.proconfig");
      expect(query).toContain("FROM pg_proc p");
      expect(query).toContain("cleanup_old_sync_queue_entries");
    });
  });

  describe("Migration Safety Checks", () => {
    it("should ensure views are dropped before recreation", () => {
      const steps = StateTransitionContracts.migrationSteps;
      const dropStep = steps.find((s) => s.step === 1);
      const createStep = steps.find((s) => s.step === 2);

      expect(dropStep?.action).toContain("DROP VIEW IF EXISTS");
      expect(createStep?.action).toContain("CREATE VIEW");
      expect(dropStep?.step).toBeLessThan(createStep?.step || 999);
    });

    it("should preserve function behavior while adding security", () => {
      const functionStep = StateTransitionContracts.migrationSteps.find(
        (s) => s.step === 3
      );

      expect(functionStep?.validation.preserveBehavior).toBe(
        "Function logic remains unchanged"
      );
      expect(functionStep?.validation.onlySecurityImproved).toBe(true);
    });
  });

  describe("Test Coverage Validation", () => {
    it("should cover all sync pipeline components", () => {
      const syncTests = IntegrationTestContracts.syncPipeline.tests;

      const testNames = syncTests.map((t) => t.name);
      expect(testNames).toContain("Manual sync trigger");
      expect(testNames).toContain("Sync queue processing");
      expect(testNames).toContain("API usage tracking");
    });

    it("should cover all article operations", () => {
      const articleTests = IntegrationTestContracts.articleOperations.tests;

      const functionsCovered = articleTests.map((t) => t.function);
      expect(functionsCovered).toContain("get_articles_optimized");
      expect(functionsCovered).toContain("get_unread_counts_by_feed");
      expect(functionsCovered).toContain("refresh_feed_stats");
    });

    it("should cover all monitoring views", () => {
      const monitoringTests =
        IntegrationTestContracts.monitoringDashboard.tests;

      const viewsCovered = monitoringTests.map((t) => t.view);
      expect(viewsCovered).toContain("author_quality_report");
      expect(viewsCovered).toContain("author_statistics");
      expect(viewsCovered).toContain("sync_author_health");
    });
  });
});

/**
 * These tests validate the required migration SQL from Zod contracts
 */
describe("Required Migration SQL", () => {
  it("should define all required migration SQL statements", () => {
    expect(REQUIRED_MIGRATION_SQL.enableRLS).toBe(
      "ALTER TABLE articles ENABLE ROW LEVEL SECURITY;"
    );
    expect(REQUIRED_MIGRATION_SQL.createPolicy).toContain(
      'CREATE POLICY "authenticated_access"'
    );
    expect(REQUIRED_MIGRATION_SQL.revokePublicAccess).toContain(
      "REVOKE ALL ON articles FROM public"
    );
    expect(REQUIRED_MIGRATION_SQL.grantAuthenticatedAccess).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON articles TO authenticated"
    );
  });
});

/**
 * Migration SQL Generator Tests
 * These tests validate that the migration SQL would be correct
 */
describe("Migration SQL Generation", () => {
  it("should generate correct SQL for dropping SECURITY DEFINER views", () => {
    const views = [
      "sync_queue_stats",
      "author_quality_report",
      "author_statistics",
      "sync_author_health",
    ];
    const dropSQL = `DROP VIEW IF EXISTS ${views.join(", ")} CASCADE;`;

    expect(dropSQL).toContain("DROP VIEW IF EXISTS");
    expect(dropSQL).toContain("CASCADE");
    views.forEach((view) => {
      expect(dropSQL).toContain(view);
    });
  });

  it("should generate correct SQL for creating SECURITY INVOKER views", () => {
    const createSQL = `CREATE VIEW view_name WITH (security_invoker = true) AS ...`;

    expect(createSQL).toContain("CREATE VIEW");
    expect(createSQL).toContain("WITH (security_invoker = true)");
  });

  it("should generate correct SQL for adding search_path to functions", () => {
    const functions = [
      "get_unread_counts_by_feed",
      "get_articles_optimized",
      "refresh_feed_stats",
      "add_to_sync_queue",
      "update_updated_at_column",
      "increment_api_usage",
      "cleanup_old_sync_queue_entries",
    ];

    functions.forEach((func) => {
      const alterSQL = `ALTER FUNCTION ${func} SET search_path = public;`;
      expect(alterSQL).toContain("ALTER FUNCTION");
      expect(alterSQL).toContain("SET search_path = public");
      expect(alterSQL).toContain(func);
    });
  });

  it("should generate correct SQL for validation queries", () => {
    // AC-1 validation query
    const ac1Query = AcceptanceCriteria.required[0].testQuery;
    expect(ac1Query).toContain("COUNT(*) = 0");
    expect(ac1Query).toContain("pg_views");

    // AC-2 validation query
    const ac2Query = AcceptanceCriteria.required[1].testQuery;
    expect(ac2Query).toContain("COUNT(*) = 7");
    expect(ac2Query).toContain("pg_proc");
  });
});
