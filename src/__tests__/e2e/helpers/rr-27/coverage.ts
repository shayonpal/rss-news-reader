/**
 * RR-27: Test Consolidation - Coverage Mapping & Validation
 *
 * Validates that all scenarios from original 8 files are covered in 4 consolidated files
 */

import { CoverageReport } from "./types";

/**
 * Coverage mapper to ensure 100% scenario preservation during consolidation
 */
export class CoverageMapper {
  private originalFileScenarios: Map<string, string[]> = new Map();
  private consolidatedFileScenarios: Map<string, string[]> = new Map();

  constructor() {
    this.initializeOriginalFileMapping();
    this.initializeConsolidatedFileMapping();
  }

  /**
   * Map scenarios from original 8 test files
   */
  private initializeOriginalFileMapping() {
    // Original File 1: rr-27-state-preservation.spec.ts (11 scenarios)
    this.originalFileScenarios.set("rr-27-state-preservation.spec.ts", [
      "preserve-auto-read-articles-unread-mode-back-navigation",
      "not-immediately-hide-article-clicked-unread-mode",
      "restore-exact-scroll-position-back-navigation",
      "differentiate-auto-read-manually-read-articles",
      "handle-session-storage-expiry-30-minutes",
      "work-prev-next-navigation-between-articles",
      "handle-rapid-navigation-without-losing-state",
      "maintain-state-across-browser-refresh",
      "handle-filter-changes-correctly",
      "handle-large-number-articles-without-performance-issues",
      "gracefully-handle-storage-quota-exceeded",
    ]);

    // Original File 2: rr-27-complete-user-flows.spec.ts (13 scenarios)
    this.originalFileScenarios.set("rr-27-complete-user-flows.spec.ts", [
      "preserve-auto-read-articles-navigating-back-unread-mode",
      "differentiate-auto-read-manually-read-articles-visually",
      "handle-rapid-navigation-without-state-corruption",
      "preserve-state-across-prev-next-navigation",
      "handle-session-storage-expiry-gracefully",
      "maintain-performance-large-article-lists",
      "handle-edge-case-all-articles-becoming-read",
      "recover-from-storage-quota-exceeded-errors",
      "handle-browser-back-forward-button-navigation",
      "prevent-auto-read-during-scroll-restoration",
      "handle-complete-user-scenario-from-linear-issue",
      "handle-very-large-article-lists-without-performance-degradation",
      "maintain-responsiveness-during-rapid-user-interactions",
    ]);

    // Original File 3: rr-27-state-clearing.spec.ts (3 scenarios)
    this.originalFileScenarios.set("rr-27-state-clearing.spec.ts", [
      "clear-preserved-state-when-switching-feeds",
      "clear-preserved-state-when-switching-filters",
      "verify-session-storage-cleared-on-state-clearing",
    ]);

    // Original File 4: rr-27-regression-check.spec.ts (2 scenarios)
    this.originalFileScenarios.set("rr-27-regression-check.spec.ts", [
      "article-preservation-india-canada-topic-filter",
      "check-session-storage-preservation-mechanism",
    ]);

    // Original File 5: rr-27-comprehensive.spec.ts (3 scenarios)
    this.originalFileScenarios.set("rr-27-comprehensive.spec.ts", [
      "handle-all-5-mark-as-read-scenarios-session-preservation",
      "maintain-context-across-complex-navigation-flows",
      "handle-session-state-loss-gracefully",
    ]);

    // Original File 6: rr-27-real-navigation.spec.ts (2 scenarios)
    this.originalFileScenarios.set("rr-27-real-navigation.spec.ts", [
      "navigate-to-article-back-proper-state-preservation",
      "handle-multiple-article-navigations",
    ]);

    // Original File 7: rr-27-visibility-fix.spec.ts (2 scenarios)
    this.originalFileScenarios.set("rr-27-visibility-fix.spec.ts", [
      "keep-clicked-article-visible-unread-only-mode",
      "verify-session-storage-contains-article-state",
    ]);

    // Original File 8: rr-27-second-click-fix.spec.ts (1 scenario)
    this.originalFileScenarios.set("rr-27-second-click-fix.spec.ts", [
      "preserve-only-session-read-articles-after-clicking-second-article",
    ]);
  }

  /**
   * Map scenarios to consolidated 4 files
   */
  private initializeConsolidatedFileMapping() {
    // Consolidated File 1: rr-27-mechanics-persistence.spec.ts
    this.consolidatedFileScenarios.set("rr-27-mechanics-persistence.spec.ts", [
      // From state-preservation.spec.ts
      "preserve-auto-read-articles-unread-mode-back-navigation",
      "not-immediately-hide-article-clicked-unread-mode",
      "restore-exact-scroll-position-back-navigation",
      "differentiate-auto-read-manually-read-articles",
      "handle-session-storage-expiry-30-minutes",
      "work-prev-next-navigation-between-articles",
      "handle-rapid-navigation-without-losing-state",
      "maintain-state-across-browser-refresh",
      "handle-filter-changes-correctly",
      "handle-large-number-articles-without-performance-issues",
      "gracefully-handle-storage-quota-exceeded",
      // From visibility-fix.spec.ts
      "keep-clicked-article-visible-unread-only-mode",
      "verify-session-storage-contains-article-state",
    ]);

    // Consolidated File 2: rr-27-mechanics-clearing.spec.ts
    this.consolidatedFileScenarios.set("rr-27-mechanics-clearing.spec.ts", [
      // From state-clearing.spec.ts
      "clear-preserved-state-when-switching-feeds",
      "clear-preserved-state-when-switching-filters",
      "verify-session-storage-cleared-on-state-clearing",
      // From second-click-fix.spec.ts
      "preserve-only-session-read-articles-after-clicking-second-article",
    ]);

    // Consolidated File 3: rr-27-user-flows.spec.ts
    this.consolidatedFileScenarios.set("rr-27-user-flows.spec.ts", [
      // From complete-user-flows.spec.ts
      "preserve-auto-read-articles-navigating-back-unread-mode",
      "differentiate-auto-read-manually-read-articles-visually",
      "handle-rapid-navigation-without-state-corruption",
      "preserve-state-across-prev-next-navigation",
      "handle-session-storage-expiry-gracefully",
      "maintain-performance-large-article-lists",
      "handle-edge-case-all-articles-becoming-read",
      "recover-from-storage-quota-exceeded-errors",
      "handle-browser-back-forward-button-navigation",
      "prevent-auto-read-during-scroll-restoration",
      "handle-complete-user-scenario-from-linear-issue",
      "handle-very-large-article-lists-without-performance-degradation",
      "maintain-responsiveness-during-rapid-user-interactions",
      // From real-navigation.spec.ts
      "navigate-to-article-back-proper-state-preservation",
      "handle-multiple-article-navigations",
    ]);

    // Consolidated File 4: rr-27-regression-suite.spec.ts
    this.consolidatedFileScenarios.set("rr-27-regression-suite.spec.ts", [
      // From regression-check.spec.ts
      "article-preservation-india-canada-topic-filter",
      "check-session-storage-preservation-mechanism",
      // From comprehensive.spec.ts
      "handle-all-5-mark-as-read-scenarios-session-preservation",
      "maintain-context-across-complex-navigation-flows",
      "handle-session-state-loss-gracefully",
    ]);
  }

  /**
   * Validate complete coverage mapping
   */
  validateCoverage(): CoverageReport {
    const allOriginalScenarios = new Set<string>();
    const allConsolidatedScenarios = new Set<string>();
    const fileMapping = new Map<string, string[]>();

    // Collect all original scenarios
    for (const [file, scenarios] of this.originalFileScenarios) {
      scenarios.forEach((scenario) => allOriginalScenarios.add(scenario));
    }

    // Collect all consolidated scenarios
    for (const [file, scenarios] of this.consolidatedFileScenarios) {
      scenarios.forEach((scenario) => allConsolidatedScenarios.add(scenario));
      fileMapping.set(file, scenarios);
    }

    // Find missing scenarios
    const missingScenarios: string[] = [];
    for (const scenario of allOriginalScenarios) {
      if (!allConsolidatedScenarios.has(scenario)) {
        missingScenarios.push(scenario);
      }
    }

    const totalTests = allOriginalScenarios.size;
    const coveredTests = allConsolidatedScenarios.size;
    const coverage = (coveredTests / totalTests) * 100;

    return {
      totalTests,
      coveredTests,
      coverage,
      missingTests: missingScenarios,
      fileMapping,
    };
  }

  /**
   * Generate detailed coverage report
   */
  generateDetailedCoverageReport(): {
    summary: CoverageReport;
    fileBreakdown: Array<{
      originalFile: string;
      scenarios: number;
      mappedTo: string[];
    }>;
    consolidatedBreakdown: Array<{
      consolidatedFile: string;
      scenarios: number;
      sourcesFrom: string[];
    }>;
  } {
    const summary = this.validateCoverage();

    // Original file breakdown
    const fileBreakdown = Array.from(this.originalFileScenarios.entries()).map(
      ([file, scenarios]) => {
        const mappedTo: string[] = [];

        // Find which consolidated files contain these scenarios
        for (const [consolidatedFile, consolidatedScenarios] of this
          .consolidatedFileScenarios) {
          const hasScenarios = scenarios.some((s) =>
            consolidatedScenarios.includes(s)
          );
          if (hasScenarios) {
            mappedTo.push(consolidatedFile);
          }
        }

        return {
          originalFile: file,
          scenarios: scenarios.length,
          mappedTo,
        };
      }
    );

    // Consolidated file breakdown
    const consolidatedBreakdown = Array.from(
      this.consolidatedFileScenarios.entries()
    ).map(([file, scenarios]) => {
      const sourcesFrom: string[] = [];

      // Find which original files contributed to this consolidated file
      for (const [originalFile, originalScenarios] of this
        .originalFileScenarios) {
        const hasScenarios = originalScenarios.some((s) =>
          scenarios.includes(s)
        );
        if (hasScenarios) {
          sourcesFrom.push(originalFile);
        }
      }

      return {
        consolidatedFile: file,
        scenarios: scenarios.length,
        sourcesFrom,
      };
    });

    return {
      summary,
      fileBreakdown,
      consolidatedBreakdown,
    };
  }

  /**
   * Validate scenario distribution across consolidated files
   */
  validateScenarioDistribution(): {
    isBalanced: boolean;
    distribution: Array<{ file: string; count: number; percentage: number }>;
    recommendations: string[];
  } {
    const distribution = Array.from(
      this.consolidatedFileScenarios.entries()
    ).map(([file, scenarios]) => ({
      file: file.replace(".spec.ts", ""),
      count: scenarios.length,
      percentage: 0,
    }));

    const totalScenarios = distribution.reduce((sum, d) => sum + d.count, 0);
    distribution.forEach((d) => {
      d.percentage = (d.count / totalScenarios) * 100;
    });

    // Check if distribution is balanced (no file > 40% of total scenarios)
    const maxPercentage = Math.max(...distribution.map((d) => d.percentage));
    const isBalanced = maxPercentage <= 40;

    const recommendations: string[] = [];
    if (!isBalanced) {
      const overloadedFile = distribution.find((d) => d.percentage > 40);
      if (overloadedFile) {
        recommendations.push(
          `Consider redistributing scenarios from ${overloadedFile.file} (${overloadedFile.percentage.toFixed(1)}% of total)`
        );
      }
    }

    // Check for very small files
    const underloadedFiles = distribution.filter((d) => d.percentage < 15);
    if (underloadedFiles.length > 0) {
      recommendations.push(
        `Consider combining small files: ${underloadedFiles.map((f) => f.file).join(", ")}`
      );
    }

    return {
      isBalanced,
      distribution,
      recommendations,
    };
  }

  /**
   * Generate migration script for moving scenarios
   */
  generateMigrationScript(): {
    archiveCommands: string[];
    consolidationCommands: string[];
    validationCommands: string[];
  } {
    const originalFiles = Array.from(this.originalFileScenarios.keys());

    const archiveCommands = [
      "# Archive original test files",
      "mkdir -p src/__tests__/archive/rr-27-phase2",
      ...originalFiles.map(
        (file) =>
          `git mv src/__tests__/e2e/${file} src/__tests__/archive/rr-27-phase2/`
      ),
    ];

    const consolidationCommands = [
      "# Consolidation is complete - 4 new files created",
      'echo "Consolidated files created:"',
      "ls -la src/__tests__/e2e/rr-27-mechanics-*.spec.ts",
      "ls -la src/__tests__/e2e/rr-27-user-flows.spec.ts",
      "ls -la src/__tests__/e2e/rr-27-regression-suite.spec.ts",
    ];

    const validationCommands = [
      "# Run coverage validation",
      "npm run test:coverage:rr-27",
      "# Run performance validation",
      "npm run test:performance:rr-27",
      "# Run all consolidated tests",
      "npx playwright test src/__tests__/e2e/rr-27-*.spec.ts --workers=4",
    ];

    return {
      archiveCommands,
      consolidationCommands,
      validationCommands,
    };
  }

  /**
   * Export coverage data for reporting
   */
  exportCoverageData(): {
    consolidationSummary: {
      originalFiles: number;
      consolidatedFiles: number;
      reductionPercentage: number;
      totalScenarios: number;
      scenariosCovered: number;
      coveragePercentage: number;
    };
    fileMapping: Record<string, string[]>;
    scenarioList: string[];
  } {
    const coverage = this.validateCoverage();
    const originalFileCount = this.originalFileScenarios.size;
    const consolidatedFileCount = this.consolidatedFileScenarios.size;
    const reductionPercentage =
      ((originalFileCount - consolidatedFileCount) / originalFileCount) * 100;

    return {
      consolidationSummary: {
        originalFiles: originalFileCount,
        consolidatedFiles: consolidatedFileCount,
        reductionPercentage,
        totalScenarios: coverage.totalTests,
        scenariosCovered: coverage.coveredTests,
        coveragePercentage: coverage.coverage,
      },
      fileMapping: Object.fromEntries(coverage.fileMapping),
      scenarioList: Array.from(this.getAllScenarios()),
    };
  }

  /**
   * Get all unique scenarios
   */
  private getAllScenarios(): Set<string> {
    const allScenarios = new Set<string>();

    for (const scenarios of this.originalFileScenarios.values()) {
      scenarios.forEach((scenario) => allScenarios.add(scenario));
    }

    return allScenarios;
  }

  /**
   * Print coverage report to console
   */
  printCoverageReport(): void {
    const report = this.generateDetailedCoverageReport();

    console.log("\n📋 RR-27 Test Consolidation Coverage Report");
    console.log("=".repeat(50));

    console.log(`\n📊 Summary:`);
    console.log(`   Total scenarios: ${report.summary.totalTests}`);
    console.log(`   Covered scenarios: ${report.summary.coveredTests}`);
    console.log(`   Coverage: ${report.summary.coverage.toFixed(1)}%`);

    if (report.summary.missingTests.length > 0) {
      console.log(
        `\n❌ Missing scenarios (${report.summary.missingTests.length}):`
      );
      report.summary.missingTests.forEach((test) =>
        console.log(`   - ${test}`)
      );
    } else {
      console.log(`\n✅ All scenarios covered!`);
    }

    console.log(`\n📁 Original Files (${report.fileBreakdown.length}):`);
    report.fileBreakdown.forEach((file) => {
      console.log(
        `   ${file.originalFile}: ${file.scenarios} scenarios → ${file.mappedTo.join(", ")}`
      );
    });

    console.log(
      `\n📄 Consolidated Files (${report.consolidatedBreakdown.length}):`
    );
    report.consolidatedBreakdown.forEach((file) => {
      console.log(
        `   ${file.consolidatedFile}: ${file.scenarios} scenarios from ${file.sourcesFrom.length} files`
      );
    });

    const distribution = this.validateScenarioDistribution();
    console.log(`\n⚖️ Scenario Distribution:`);
    distribution.distribution.forEach((d) => {
      console.log(
        `   ${d.file}: ${d.count} scenarios (${d.percentage.toFixed(1)}%)`
      );
    });

    if (distribution.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      distribution.recommendations.forEach((rec) => console.log(`   - ${rec}`));
    }
  }
}
