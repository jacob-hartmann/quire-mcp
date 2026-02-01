/**
 * Quire API Types
 *
 * Type definitions for the Quire API responses.
 * These are based on the Quire API documentation: https://quire.io/dev/api/
 */

/**
 * User profile returned by GET /user/id/me
 */
export interface QuireUser {
  id: string;
  oid: string;
  name: string;
  nameText: string;
  email?: string;
  image?: string;
  description?: string;
  website?: string;
  timezone?: string;
  locale?: string;
}

/**
 * Result type for Quire API calls
 */
export type QuireResult<T> =
  | { success: true; data: T }
  | { success: false; error: QuireClientError };

/**
 * Custom error class for Quire client errors
 */
export class QuireClientError extends Error {
  constructor(
    message: string,
    public readonly code: QuireErrorCode,
    public readonly statusCode?: number,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "QuireClientError";
  }
}

/**
 * Error codes for categorizing Quire client errors
 */
export type QuireErrorCode =
  | "MISSING_TOKEN"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "UNKNOWN";
