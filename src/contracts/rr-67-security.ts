/**
 * Contract Schemas for RR-67: Security Validation
 *
 * Defines runtime validation contracts for security fixes in the database layer.
 * These schemas ensure proper error handling, permission checks, and data integrity.
 */

import { z } from "zod";

/**
 * Schema for individual security issues detected during validation
 */
export const SecurityIssueSchema = z
  .object({
    type: z.enum([
      "missing_permission",
      "missing_constraint",
      "exposed_field",
      "missing_rls",
    ]),
    severity: z.enum(["error", "warning"]),
    resource: z.string(),
    message: z.string(),
    location: z.string().optional(),
  })
  .strict();

export type SecurityIssue = z.infer<typeof SecurityIssueSchema>;

/**
 * Schema for security validation reports
 */
export const SecurityReportSchema = z
  .object({
    errorCount: z.number().nonnegative(),
    warningCount: z.number().nonnegative(),
    errors: z.array(SecurityIssueSchema),
    warnings: z.array(SecurityIssueSchema),
  })
  .strict();

export type SecurityReport = z.infer<typeof SecurityReportSchema>;

/**
 * Schema for database state validation
 */
export const DatabaseStateSchema = z
  .object({
    hasCorrectPermissions: z.boolean(),
    hasRequiredConstraints: z.boolean(),
    hasRLSEnabled: z.boolean(),
    exposedFields: z.array(z.string()),
  })
  .strict();

export type DatabaseState = z.infer<typeof DatabaseStateSchema>;

/**
 * Schema for database function state
 */
export const FunctionStateSchema = z
  .object({
    name: z.string(),
    hasSecurityDefiner: z.boolean(),
    hasCorrectOwner: z.boolean(),
    performsAuthCheck: z.boolean(),
  })
  .strict();

export type FunctionState = z.infer<typeof FunctionStateSchema>;

/**
 * Schema for view security state
 */
export const ViewStateSchema = z
  .object({
    name: z.string(),
    hasRLSEnabled: z.boolean(),
    hasCorrectPermissions: z.boolean(),
    exposesPrivateData: z.boolean(),
  })
  .strict();

export type ViewState = z.infer<typeof ViewStateSchema>;

/**
 * Required migration SQL for security fixes
 * This is a string constant that must be present in the migration
 */
export const REQUIRED_MIGRATION_SQL = {
  enableRLS: `ALTER TABLE articles ENABLE ROW LEVEL SECURITY;`,
  createPolicy: `CREATE POLICY "authenticated_access" ON articles FOR ALL USING (auth.uid() IS NOT NULL);`,
  revokePublicAccess: `REVOKE ALL ON articles FROM public;`,
  grantAuthenticatedAccess: `GRANT SELECT, INSERT, UPDATE, DELETE ON articles TO authenticated;`,
} as const;

/**
 * Contract validation functions
 */
export const SecurityValidation = {
  /**
   * Validates that a security report meets minimum requirements
   */
  validateReport: (report: unknown): SecurityReport => {
    return SecurityReportSchema.parse(report);
  },

  /**
   * Checks if database state passes security requirements
   */
  validateDatabaseState: (state: unknown): DatabaseState => {
    const validated = DatabaseStateSchema.parse(state);
    if (!validated.hasRLSEnabled) {
      throw new Error("Row Level Security must be enabled");
    }
    if (!validated.hasCorrectPermissions) {
      throw new Error("Database permissions are not correctly configured");
    }
    if (validated.exposedFields.length > 0) {
      throw new Error(
        `Private fields exposed: ${validated.exposedFields.join(", ")}`
      );
    }
    return validated;
  },

  /**
   * Validates function security configuration
   */
  validateFunctionSecurity: (func: unknown): FunctionState => {
    const validated = FunctionStateSchema.parse(func);
    if (!validated.performsAuthCheck) {
      throw new Error(
        `Function ${validated.name} does not perform authentication check`
      );
    }
    return validated;
  },

  /**
   * Validates view security configuration
   */
  validateViewSecurity: (view: unknown): ViewState => {
    const validated = ViewStateSchema.parse(view);
    if (validated.exposesPrivateData) {
      throw new Error(`View ${validated.name} exposes private data`);
    }
    return validated;
  },
};
