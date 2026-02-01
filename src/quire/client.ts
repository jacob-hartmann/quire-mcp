/**
 * Quire API Client
 *
 * A typed fetch wrapper for the Quire API with:
 * - Timeouts
 * - Retry/backoff on 429/503
 * - Consistent error mapping
 *
 * Rate Limits (Free plan):
 * - 25 requests per minute
 * - 120 requests per hour
 *
 * @see https://quire.io/dev/api/
 */

import type { QuireUser, QuireResult } from "./types.js";
import { QuireClientError } from "./types.js";

const QUIRE_API_BASE_URL = "https://quire.io/api";
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

interface ClientOptions {
  token: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Create an AbortSignal with timeout
 */
function createTimeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse error response from Quire API
 */
function parseErrorCode(
  status: number
): Pick<QuireClientError, "code" | "retryable"> {
  switch (status) {
    case 401:
      return { code: "UNAUTHORIZED", retryable: false };
    case 403:
      return { code: "FORBIDDEN", retryable: false };
    case 404:
      return { code: "NOT_FOUND", retryable: false };
    case 429:
      return { code: "RATE_LIMITED", retryable: true };
    case 503:
      return { code: "SERVER_ERROR", retryable: true };
    default:
      if (status >= 500) {
        return { code: "SERVER_ERROR", retryable: true };
      }
      return { code: "UNKNOWN", retryable: false };
  }
}

/**
 * Quire API Client class
 */
export class QuireClient {
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: ClientOptions) {
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? MAX_RETRIES;
  }

  /**
   * Make an authenticated request to the Quire API
   */
  private async request<T>(
    endpoint: string,
    retryCount = 0
  ): Promise<QuireResult<T>> {
    const url = `${QUIRE_API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
        },
        signal: createTimeoutSignal(this.timeoutMs),
      });

      if (response.ok) {
        const data = (await response.json()) as T;
        return { success: true, data };
      }

      // Handle error responses
      const { code, retryable } = parseErrorCode(response.status);

      // Retry logic for retryable errors
      if (retryable && retryCount < this.maxRetries) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
        console.error(
          `[quire-mcp] Request failed with ${response.status}, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`
        );
        await sleep(delay);
        return await this.request<T>(endpoint, retryCount + 1);
      }

      // Parse error body if available
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorBody = (await response.json()) as { message?: string };
        if (errorBody.message) {
          errorMessage = errorBody.message;
        }
      } catch {
        // Ignore JSON parse errors for error body
      }

      return {
        success: false,
        error: new QuireClientError(
          errorMessage,
          code,
          response.status,
          retryable
        ),
      };
    } catch (error) {
      // Handle network/timeout errors
      if (error instanceof Error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
          return {
            success: false,
            error: new QuireClientError(
              `Request timed out after ${this.timeoutMs}ms`,
              "TIMEOUT",
              undefined,
              true
            ),
          };
        }

        return {
          success: false,
          error: new QuireClientError(error.message, "NETWORK_ERROR"),
        };
      }

      return {
        success: false,
        error: new QuireClientError("Unknown error occurred", "UNKNOWN"),
      };
    }
  }

  /**
   * Get the current authenticated user's profile
   *
   * @see https://quire.io/dev/api/#userIdMe
   */
  async getMe(): Promise<QuireResult<QuireUser>> {
    return this.request<QuireUser>("/user/id/me");
  }
}

/**
 * Create a QuireClient from environment variables (synchronous).
 * Only checks QUIRE_ACCESS_TOKEN; does not support OAuth flow.
 * For OAuth support, use createClientFromAuth() instead.
 *
 * @throws {QuireClientError} if QUIRE_ACCESS_TOKEN is not set
 */
export function createClientFromEnv(): QuireResult<QuireClient> {
  const token = process.env["QUIRE_ACCESS_TOKEN"];

  if (!token) {
    return {
      success: false,
      error: new QuireClientError(
        "QUIRE_ACCESS_TOKEN environment variable is not set. " +
          "Please configure QUIRE_OAUTH_CLIENT_ID and QUIRE_OAUTH_CLIENT_SECRET " +
          "for OAuth authentication.",
        "MISSING_TOKEN"
      ),
    };
  }

  return {
    success: true,
    data: new QuireClient({ token }),
  };
}

/**
 * Create a QuireClient using the full authentication chain:
 *   1. QUIRE_ACCESS_TOKEN env var (if set)
 *   2. Cached token from disk
 *   3. Refresh using stored refresh_token
 *   4. Interactive OAuth login
 *
 * This is async because it may need to perform OAuth or token refresh.
 */
export async function createClientFromAuth(): Promise<
  QuireResult<QuireClient>
> {
  // Import dynamically to avoid circular deps and keep sync path fast
  const { getQuireAccessToken, QuireAuthError } = await import("./auth.js");

  try {
    const result = await getQuireAccessToken();
    return {
      success: true,
      data: new QuireClient({ token: result.accessToken }),
    };
  } catch (err) {
    if (err instanceof QuireAuthError) {
      return {
        success: false,
        error: new QuireClientError(err.message, "MISSING_TOKEN"),
      };
    }
    return {
      success: false,
      error: new QuireClientError(
        err instanceof Error ? err.message : "Unknown authentication error",
        "UNKNOWN"
      ),
    };
  }
}
