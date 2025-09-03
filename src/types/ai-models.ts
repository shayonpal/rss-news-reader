/**
 * RR-266: AI Model Metadata Types
 * Defines TypeScript interfaces for AI model management
 */

/**
 * Represents an AI model record from the database
 * Minimal structure for tracking available models
 */
export interface AIModel {
  /** UUID primary key from database */
  id: string;

  /** Unique identifier for the model (e.g., 'claude-opus-4-1') */
  model_id: string;

  /** Display name for the model */
  name: string;

  /** Optional description of model capabilities */
  description: string | null;

  /** Timestamp when the model was added to the database (ISO 8601 format) */
  created_at: string; // ISO 8601 datetime string (e.g., "2025-01-03T12:00:00Z")
}
