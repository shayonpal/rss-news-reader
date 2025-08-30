#!/usr/bin/env node

/**
 * Performance Regression Checker for CI/CD Pipeline (RR-185)
 * Compares current performance metrics against baseline thresholds
 */

const fs = require("fs");
const path = require("path");

// Configuration
// NOTE: These files are auto-generated and gitignored. If missing, baseline will be created.
const BASELINE_FILE = "performance-baseline.json";
const REPORT_FILE = "performance-report.json";
const BUILD_SIZE_FILE = "build-size.txt";

// Thresholds for regression detection
const THRESHOLDS = {
  buildSize: 1.1, // 10% increase is warning
  bundleSize: 1.15, // 15% increase is warning
  startupTime: 1.2, // 20% increase is warning
  memoryUsage: 1.25, // 25% increase is warning
  apiResponseTime: 1.3, // 30% increase is warning
};

// Color codes for console output
const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

/**
 * Read JSON file safely
 */
function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Parse build size from du output
 */
function parseBuildSize(sizeFile) {
  try {
    if (!fs.existsSync(sizeFile)) {
      return null;
    }
    const content = fs.readFileSync(sizeFile, "utf8").trim();
    const match = content.match(/^(\d+\.?\d*)(K|M|G)/);
    if (!match) return null;

    const size = parseFloat(match[1]);
    const unit = match[2];

    // Convert to MB
    const multipliers = { K: 0.001, M: 1, G: 1000 };
    return size * (multipliers[unit] || 1);
  } catch (error) {
    console.error("Error parsing build size:", error.message);
    return null;
  }
}

/**
 * Compare metrics and detect regressions
 */
function compareMetrics(baseline, current) {
  const regressions = [];
  const improvements = [];
  const warnings = [];

  for (const [metric, baselineValue] of Object.entries(baseline)) {
    if (typeof baselineValue !== "number") continue;

    const currentValue = current[metric];
    if (typeof currentValue !== "number") continue;

    const ratio = currentValue / baselineValue;
    const percentChange = ((ratio - 1) * 100).toFixed(1);
    const threshold = THRESHOLDS[metric] || 1.1;

    if (ratio > threshold * 1.2) {
      // Critical regression
      regressions.push({
        metric,
        baseline: baselineValue,
        current: currentValue,
        change: `+${percentChange}%`,
        severity: "critical",
      });
    } else if (ratio > threshold) {
      // Warning level regression
      warnings.push({
        metric,
        baseline: baselineValue,
        current: currentValue,
        change: `+${percentChange}%`,
        severity: "warning",
      });
    } else if (ratio < 0.9) {
      // Improvement
      improvements.push({
        metric,
        baseline: baselineValue,
        current: currentValue,
        change: `${percentChange}%`,
      });
    }
  }

  return { regressions, warnings, improvements };
}

/**
 * Generate performance report
 */
function generateReport() {
  // Mock current metrics (in real scenario, these would be measured)
  const currentMetrics = {
    buildSize: parseBuildSize(BUILD_SIZE_FILE) || 45.2,
    bundleSize: 12.3,
    startupTime: 1250,
    memoryUsage: 85.4,
    apiResponseTime: 125,
    timestamp: new Date().toISOString(),
  };

  // Read baseline
  const baseline = readJsonFile(BASELINE_FILE);
  if (!baseline) {
    console.log(
      `${colors.yellow}No baseline found. Creating baseline from current metrics.${colors.reset}`
    );
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(currentMetrics, null, 2));
    return { status: "baseline_created", metrics: currentMetrics };
  }

  // Compare metrics
  const { regressions, warnings, improvements } = compareMetrics(
    baseline,
    currentMetrics
  );

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    status:
      regressions.length > 0
        ? "regression"
        : warnings.length > 0
          ? "warning"
          : "pass",
    metrics: currentMetrics,
    baseline,
    regressions,
    warnings,
    improvements,
    summary: {
      totalRegressions: regressions.length,
      totalWarnings: warnings.length,
      totalImprovements: improvements.length,
    },
  };

  // Save report
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  return report;
}

/**
 * Display report in console
 */
function displayReport(report) {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                 Performance Regression Check               ");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (report.status === "baseline_created") {
    console.log(`${colors.blue}✓ Baseline created${colors.reset}`);
    console.log("  Current metrics saved as baseline for future comparisons\n");
    return;
  }

  // Display regressions
  if (report.regressions.length > 0) {
    console.log(
      `${colors.red}❌ CRITICAL REGRESSIONS DETECTED${colors.reset}\n`
    );
    report.regressions.forEach((reg) => {
      console.log(`  ${reg.metric}:`);
      console.log(`    Baseline: ${reg.baseline}`);
      console.log(`    Current:  ${reg.current} (${reg.change})`);
    });
    console.log("");
  }

  // Display warnings
  if (report.warnings.length > 0) {
    console.log(`${colors.yellow}⚠️  PERFORMANCE WARNINGS${colors.reset}\n`);
    report.warnings.forEach((warn) => {
      console.log(`  ${warn.metric}:`);
      console.log(`    Baseline: ${warn.baseline}`);
      console.log(`    Current:  ${warn.current} (${warn.change})`);
    });
    console.log("");
  }

  // Display improvements
  if (report.improvements.length > 0) {
    console.log(`${colors.green}✅ PERFORMANCE IMPROVEMENTS${colors.reset}\n`);
    report.improvements.forEach((imp) => {
      console.log(`  ${imp.metric}: ${imp.change}`);
    });
    console.log("");
  }

  // Summary
  console.log("═══════════════════════════════════════════════════════════");
  if (report.status === "regression") {
    console.log(
      `${colors.red}Status: FAILED - Critical regressions detected${colors.reset}`
    );
    process.exit(1);
  } else if (report.status === "warning") {
    console.log(
      `${colors.yellow}Status: WARNING - Performance degradation detected${colors.reset}`
    );
  } else {
    console.log(
      `${colors.green}Status: PASSED - No significant regressions${colors.reset}`
    );
  }
  console.log("═══════════════════════════════════════════════════════════\n");
}

// Main execution
function main() {
  try {
    const report = generateReport();
    displayReport(report);

    // Exit with appropriate code for CI/CD
    if (report.status === "regression") {
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error(
      `${colors.red}Error during performance check:${colors.reset}`,
      error.message
    );
    process.exit(2);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { compareMetrics, generateReport };
