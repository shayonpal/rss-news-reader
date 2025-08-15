#!/usr/bin/env node

/**
 * OpenAPI Coverage Validation Script
 *
 * Validates that all health endpoints are documented in the OpenAPI specification
 * by fetching the OpenAPI document from the running server.
 *
 * Usage:
 * 1. Start the development server: npm run dev
 * 2. Run this script: node scripts/validate-openapi-coverage.js
 */

const fs = require("fs");
const path = require("path");

// RR-208: Expected endpoints for 100% coverage (45 total)
const EXPECTED_HEALTH_ENDPOINTS = [
  "GET /api/health",
  "GET /api/health/app",
  "GET /api/health/db",
  "GET /api/health/cron",
  "GET /api/health/parsing",
  "GET /api/health/claude",
];

const EXPECTED_SYNC_ENDPOINTS = [
  "POST /api/sync",
  "GET /api/sync/status/{syncId}",
  "GET /api/sync/last-sync",
  "POST /api/sync/metadata",
  "POST /api/sync/refresh-view",
  "POST /api/sync/bidirectional",
  "GET /api/sync/api-usage",
];

const EXPECTED_ARTICLES_ENDPOINTS = [
  "GET /api/articles/paginated",
  "POST /api/articles/{id}/fetch-content",
  "POST /api/articles/{id}/summarize",
  "GET /api/articles/{id}/tags",
];

const EXPECTED_TAGS_ENDPOINTS = [
  "GET /api/tags",
  "POST /api/tags",
  "GET /api/tags/{id}",
  "PATCH /api/tags/{id}",
  "DELETE /api/tags/{id}",
];

const EXPECTED_INOREADER_ENDPOINTS = [
  "GET /api/inoreader/user-info",
  "GET /api/inoreader/subscriptions",
  "GET /api/inoreader/stream-contents",
  "GET /api/inoreader/unread-counts",
  "POST /api/inoreader/edit-tag",
  "GET /api/inoreader/debug",
  "GET /api/inoreader/dev",
  "POST /api/inoreader/dev",
];

const EXPECTED_AUTH_ENDPOINTS = ["GET /api/auth/inoreader/status"];

const EXPECTED_TEST_ENDPOINTS = [
  "GET /api/test/check-headers",
  "GET /api/test/audit-capture",
  "GET /api/test/check-duplicates",
  "GET /api/test/simulate-headers",
  "GET /api/test/simulate-rate-limit",
  "POST /api/test/simulate-rate-limit",
  "POST /api/test/force-update-usage",
];

const EXPECTED_ANALYTICS_ENDPOINTS = ["GET /api/analytics/fetch-stats"];

const EXPECTED_FEEDS_ENDPOINTS = [
  "GET /api/feeds/{id}/stats",
  "DELETE /api/feeds/{id}/stats",
];

const EXPECTED_USERS_ENDPOINTS = [
  "GET /api/users/{id}/timezone",
  "PUT /api/users/{id}/timezone",
];

const EXPECTED_LOGS_ENDPOINTS = ["POST /api/logs/inoreader"];

const EXPECTED_INSOMNIA_ENDPOINTS = ["GET /api/insomnia.json"];

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function fetchOpenAPISpec() {
  try {
    const response = await fetch(
      "http://localhost:3000/reader/api-docs/openapi.json"
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to fetch OpenAPI spec: ${error.message}`);
  }
}

async function validateCoverage() {
  try {
    log("blue", "🔍 RSS News Reader - OpenAPI Coverage Validation");
    log("blue", "================================================");
    console.log();

    // Fetch OpenAPI document from running server
    log("cyan", "📋 Fetching OpenAPI specification from server...");
    const openApiDoc = await fetchOpenAPISpec();

    if (!openApiDoc || !openApiDoc.paths) {
      log("red", "❌ Failed to fetch OpenAPI document or no paths found");
      return false;
    }

    // Extract documented endpoints
    const documentedEndpoints = [];
    for (const [path, methods] of Object.entries(openApiDoc.paths)) {
      for (const method of Object.keys(methods)) {
        documentedEndpoints.push(`${method.toUpperCase()} ${path}`);
      }
    }

    log("cyan", `📊 Found ${documentedEndpoints.length} documented endpoints`);
    console.log();

    // Check coverage for all endpoint categories (RR-208)
    const allExpectedEndpoints = [
      ...EXPECTED_HEALTH_ENDPOINTS,
      ...EXPECTED_SYNC_ENDPOINTS,
      ...EXPECTED_ARTICLES_ENDPOINTS,
      ...EXPECTED_TAGS_ENDPOINTS,
      ...EXPECTED_INOREADER_ENDPOINTS,
      ...EXPECTED_AUTH_ENDPOINTS,
      ...EXPECTED_TEST_ENDPOINTS,
      ...EXPECTED_ANALYTICS_ENDPOINTS,
      ...EXPECTED_FEEDS_ENDPOINTS,
      ...EXPECTED_USERS_ENDPOINTS,
      ...EXPECTED_LOGS_ENDPOINTS,
      ...EXPECTED_INSOMNIA_ENDPOINTS,
    ];

    // Check all endpoint categories
    const categoryResults = {};
    const categories = [
      { name: "Health", endpoints: EXPECTED_HEALTH_ENDPOINTS },
      { name: "Sync", endpoints: EXPECTED_SYNC_ENDPOINTS },
      { name: "Articles", endpoints: EXPECTED_ARTICLES_ENDPOINTS },
      { name: "Tags", endpoints: EXPECTED_TAGS_ENDPOINTS },
      { name: "Inoreader", endpoints: EXPECTED_INOREADER_ENDPOINTS },
      { name: "Auth", endpoints: EXPECTED_AUTH_ENDPOINTS },
      { name: "Test", endpoints: EXPECTED_TEST_ENDPOINTS },
      { name: "Analytics", endpoints: EXPECTED_ANALYTICS_ENDPOINTS },
      { name: "Feeds", endpoints: EXPECTED_FEEDS_ENDPOINTS },
      { name: "Users", endpoints: EXPECTED_USERS_ENDPOINTS },
      { name: "Logs", endpoints: EXPECTED_LOGS_ENDPOINTS },
      { name: "Insomnia", endpoints: EXPECTED_INSOMNIA_ENDPOINTS },
    ];

    let totalCovered = 0;
    const results = [];

    for (const category of categories) {
      log("bright", `${category.name} Endpoints Coverage Report:`);
      log("bright", "=".repeat(40));

      let categoryCovered = 0;
      const categoryResults = [];

      for (const expectedEndpoint of category.endpoints) {
        const isDocumented = documentedEndpoints.includes(expectedEndpoint);
        const status = isDocumented ? "✅" : "❌";
        const color = isDocumented ? "green" : "red";

        log(color, `${status} ${expectedEndpoint}`);

        categoryResults.push({
          endpoint: expectedEndpoint,
          documented: isDocumented,
        });

        if (isDocumented) categoryCovered++;
      }

      const categoryPercentage = Math.round(
        (categoryCovered / category.endpoints.length) * 100
      );

      log(
        categoryPercentage === 100 ? "green" : "yellow",
        `Coverage: ${categoryCovered}/${category.endpoints.length} (${categoryPercentage}%)`
      );
      console.log();

      results.push(...categoryResults);
      totalCovered += categoryCovered;
    }

    const overallCoveragePercentage = Math.round(
      (totalCovered / allExpectedEndpoints.length) * 100
    );

    const coverageColor =
      overallCoveragePercentage === 100
        ? "green"
        : overallCoveragePercentage >= 80
          ? "yellow"
          : "red";

    log("bright", "📈 Overall Coverage Summary:");
    log("bright", "==========================");
    log(
      coverageColor,
      `Total: ${totalCovered}/${allExpectedEndpoints.length} endpoints (${overallCoveragePercentage}%)`
    );

    // Show category breakdown
    log("bright", "\nBy Category:");
    for (const category of categories) {
      const categoryCovered = results.filter(
        (r) => category.endpoints.includes(r.endpoint) && r.documented
      ).length;
      const categoryPercentage = Math.round(
        (categoryCovered / category.endpoints.length) * 100
      );
      log(
        categoryPercentage === 100 ? "green" : "yellow",
        `  ${category.name}: ${categoryCovered}/${category.endpoints.length} (${categoryPercentage}%)`
      );
    }

    const coveragePercentage = overallCoveragePercentage;

    // List any missing endpoints
    const missingEndpoints = results.filter((r) => !r.documented);
    if (missingEndpoints.length > 0) {
      console.log();
      log("red", "❌ Missing Endpoints:");
      missingEndpoints.forEach((endpoint) => {
        log("red", `   - ${endpoint.endpoint}`);
      });
    }

    // Additional validation - check for required fields
    console.log();
    log("cyan", "🔍 Validating OpenAPI document structure...");

    const validationResults = {
      hasInfo: !!openApiDoc.info,
      hasTitle: !!openApiDoc.info?.title,
      hasVersion: !!openApiDoc.info?.version,
      hasServers: !!openApiDoc.servers && openApiDoc.servers.length > 0,
      hasHealthTag: documentedEndpoints.some((e) => e.includes("/health")),
    };

    for (const [check, passed] of Object.entries(validationResults)) {
      const status = passed ? "✅" : "❌";
      const color = passed ? "green" : "red";
      log(color, `${status} ${check}`);
    }

    console.log();

    // Generate category breakdown for report
    const categoryBreakdown = {};
    for (const category of categories) {
      const categoryCovered = results.filter(
        (r) => category.endpoints.includes(r.endpoint) && r.documented
      ).length;
      categoryBreakdown[category.name.toLowerCase()] = {
        expected: category.endpoints.length,
        documented: categoryCovered,
        percentage: Math.round(
          (categoryCovered / category.endpoints.length) * 100
        ),
      };
    }

    // Generate detailed report
    const report = {
      timestamp: new Date().toISOString(),
      totalExpected: allExpectedEndpoints.length,
      totalDocumented: totalCovered,
      coveragePercentage,
      categories: categoryBreakdown,
      endpoints: results,
      validation: validationResults,
      openApiInfo: {
        title: openApiDoc.info?.title,
        version: openApiDoc.info?.version,
        endpointCount: documentedEndpoints.length,
      },
    };

    // Save detailed report
    const reportPath = path.join(__dirname, "../coverage-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log("cyan", `📄 Detailed report saved to: ${reportPath}`);

    console.log();

    // Final result
    if (
      coveragePercentage === 100 &&
      Object.values(validationResults).every((v) => v)
    ) {
      log("green", "🎉 SUCCESS: All endpoints are properly documented!");
      log(
        "green",
        "✅ RR-208: 100% OpenAPI coverage achieved (45/45 endpoints)"
      );
      return true;
    } else {
      log("red", "❌ FAILURE: OpenAPI documentation is incomplete");
      log(
        "yellow",
        `⚠️  Missing ${allExpectedEndpoints.length - totalCovered} endpoints`
      );

      // Show which categories are incomplete
      for (const category of categories) {
        const categoryCovered = results.filter(
          (r) => category.endpoints.includes(r.endpoint) && r.documented
        ).length;
        if (categoryCovered < category.endpoints.length) {
          log("yellow", `⚠️  Missing ${category.name} endpoints`);
        }
      }
      return false;
    }
  } catch (error) {
    if (error.message.includes("fetch")) {
      log("red", "❌ Error: Could not connect to development server");
      log("yellow", "💡 Please ensure the development server is running:");
      log("yellow", "   npm run dev");
      log("yellow", "   Then visit: http://localhost:3000/reader/api-docs");
    } else {
      log("red", "❌ Error during validation:");
      console.error(error);
    }
    return false;
  }
}

// CLI execution
if (require.main === module) {
  validateCoverage().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { validateCoverage };
