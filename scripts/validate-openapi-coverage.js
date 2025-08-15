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

// Expected health endpoints for RR-200
const EXPECTED_HEALTH_ENDPOINTS = [
  "GET /api/health",
  "GET /api/health/app",
  "GET /api/health/db",
  "GET /api/health/cron",
  "GET /api/health/parsing",
  "GET /api/health/claude",
];

// Expected Inoreader endpoints for RR-203
const EXPECTED_INOREADER_ENDPOINTS = [
  "GET /api/inoreader/user-info",
  "GET /api/inoreader/subscriptions",
  "GET /api/inoreader/stream-contents",
  "GET /api/inoreader/unread-counts",
  "POST /api/inoreader/edit-tag",
  "GET /api/inoreader/debug",
  "GET /api/inoreader/dev",
];

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

    // Check coverage for both Health and Inoreader endpoints
    const allExpectedEndpoints = [
      ...EXPECTED_HEALTH_ENDPOINTS,
      ...EXPECTED_INOREADER_ENDPOINTS,
    ];

    // Check Health endpoints
    log("bright", "Health Endpoints Coverage Report:");
    log("bright", "================================");

    const healthResults = [];
    let healthCovered = 0;

    for (const expectedEndpoint of EXPECTED_HEALTH_ENDPOINTS) {
      const isDocumented = documentedEndpoints.includes(expectedEndpoint);
      const status = isDocumented ? "✅" : "❌";
      const color = isDocumented ? "green" : "red";

      log(color, `${status} ${expectedEndpoint}`);

      healthResults.push({
        endpoint: expectedEndpoint,
        documented: isDocumented,
      });

      if (isDocumented) healthCovered++;
    }

    console.log();

    // Check Inoreader endpoints
    log("bright", "Inoreader Endpoints Coverage Report:");
    log("bright", "===================================");

    const inoreaderResults = [];
    let inoreaderCovered = 0;

    for (const expectedEndpoint of EXPECTED_INOREADER_ENDPOINTS) {
      const isDocumented = documentedEndpoints.includes(expectedEndpoint);
      const status = isDocumented ? "✅" : "❌";
      const color = isDocumented ? "green" : "red";

      log(color, `${status} ${expectedEndpoint}`);

      inoreaderResults.push({
        endpoint: expectedEndpoint,
        documented: isDocumented,
      });

      if (isDocumented) inoreaderCovered++;
    }

    console.log();

    // Calculate and display coverage percentage
    const totalCovered = healthCovered + inoreaderCovered;
    const results = [...healthResults, ...inoreaderResults];

    const healthCoveragePercentage = Math.round(
      (healthCovered / EXPECTED_HEALTH_ENDPOINTS.length) * 100
    );
    const inoreaderCoveragePercentage = Math.round(
      (inoreaderCovered / EXPECTED_INOREADER_ENDPOINTS.length) * 100
    );
    const overallCoveragePercentage = Math.round(
      (totalCovered / allExpectedEndpoints.length) * 100
    );

    const coverageColor =
      overallCoveragePercentage === 100
        ? "green"
        : overallCoveragePercentage >= 80
          ? "yellow"
          : "red";

    log("bright", "📈 Coverage Summary:");
    log("bright", "==================");
    log(
      healthCoveragePercentage === 100 ? "green" : "yellow",
      `Health: ${healthCovered}/${EXPECTED_HEALTH_ENDPOINTS.length} endpoints (${healthCoveragePercentage}%)`
    );
    log(
      inoreaderCoveragePercentage === 100 ? "green" : "yellow",
      `Inoreader: ${inoreaderCovered}/${EXPECTED_INOREADER_ENDPOINTS.length} endpoints (${inoreaderCoveragePercentage}%)`
    );
    log(
      coverageColor,
      `Overall: ${totalCovered}/${allExpectedEndpoints.length} endpoints (${overallCoveragePercentage}%)`
    );

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

    // Generate detailed report
    const report = {
      timestamp: new Date().toISOString(),
      totalExpected: allExpectedEndpoints.length,
      totalDocumented: totalCovered,
      coveragePercentage,
      health: {
        expected: EXPECTED_HEALTH_ENDPOINTS.length,
        documented: healthCovered,
        percentage: healthCoveragePercentage,
      },
      inoreader: {
        expected: EXPECTED_INOREADER_ENDPOINTS.length,
        documented: inoreaderCovered,
        percentage: inoreaderCoveragePercentage,
      },
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
      log("green", "✅ RR-200: Health endpoints documented (100%)");
      log("green", "✅ RR-203: Inoreader endpoints documented (100%)");
      return true;
    } else {
      log("red", "❌ FAILURE: OpenAPI documentation is incomplete");
      if (healthCoveragePercentage < 100) {
        log("yellow", "⚠️  Missing health endpoints (RR-200)");
      }
      if (inoreaderCoveragePercentage < 100) {
        log("yellow", "⚠️  Missing Inoreader endpoints (RR-203)");
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
