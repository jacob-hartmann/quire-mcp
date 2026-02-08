/**
 * Quire OAuth Helpers
 *
 * OAuth 2.0 authorization code flow for Quire API.
 *
 * Endpoints:
 * - Authorization: https://quire.io/oauth
 * - Token:         https://quire.io/oauth/token
 *
 * @see https://quire.io/dev/api/#authentication
 */

import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  QUIRE_OAUTH_AUTHORIZE_URL,
  QUIRE_OAUTH_TOKEN_URL,
  FETCH_TIMEOUT_MS,
  TOKEN_EXPIRY_BUFFER_MS,
  DEFAULT_REDIRECT_URI,
} from "../constants.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Stored token data (persisted to disk)
 */
export interface QuireTokenData {
  accessToken: string;
  refreshToken?: string;
  /** ISO 8601 timestamp when the access token expires */
  expiresAt?: string;
}

/**
 * Response from Quire token endpoint
 */
const QuireTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  /** Seconds until expiration */
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().optional(),
});

export type QuireTokenResponse = z.infer<typeof QuireTokenResponseSchema>;

/**
 * OAuth configuration from environment
 */
export interface QuireOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Error thrown during OAuth operations
 */
export class QuireOAuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_CONFIG"
      | "TOKEN_EXCHANGE_FAILED"
      | "REFRESH_FAILED"
      | "INVALID_RESPONSE"
      | "USER_DENIED"
      | "OAUTH_FAILED"
  ) {
    super(message);
    this.name = "QuireOAuthError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random state parameter for CSRF protection
 */
export function generateState(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Build the Quire OAuth authorization URL
 */
export function buildAuthorizeUrl(
  config: QuireOAuthConfig,
  state: string
): string {
  const url = new URL(QUIRE_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Exchange an authorization code for tokens
 */
export async function exchangeCodeForToken(
  config: QuireOAuthConfig,
  code: string
): Promise<QuireTokenData> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const controller = new AbortController();
  /* v8 ignore start -- timeout callback only fires on real network delays */
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  /* v8 ignore stop */

  let response: Response;
  try {
    response = await fetch(QUIRE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();

  if (!response.ok) {
    throw new QuireOAuthError(
      `Token exchange failed (${response.status}): ${text.slice(0, 500)}`,
      "TOKEN_EXCHANGE_FAILED"
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new QuireOAuthError(
      "Token endpoint returned invalid JSON",
      "INVALID_RESPONSE"
    );
  }

  const parsed = QuireTokenResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new QuireOAuthError(
      `Invalid token response: ${parsed.error.message}`,
      "INVALID_RESPONSE"
    );
  }

  return tokenResponseToData(parsed.data);
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(
  config: QuireOAuthConfig,
  refreshToken: string
): Promise<QuireTokenData> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(QUIRE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();

  if (!response.ok) {
    throw new QuireOAuthError(
      `Token refresh failed (${response.status}): ${text.slice(0, 500)}`,
      "REFRESH_FAILED"
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new QuireOAuthError(
      "Token endpoint returned invalid JSON during refresh",
      "INVALID_RESPONSE"
    );
  }

  const parsed = QuireTokenResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new QuireOAuthError(
      `Invalid refresh response: ${parsed.error.message}`,
      "INVALID_RESPONSE"
    );
  }

  return tokenResponseToData(parsed.data);
}

/**
 * Convert token response to stored data format
 */
function tokenResponseToData(response: QuireTokenResponse): QuireTokenData {
  const data: QuireTokenData = {
    accessToken: response.access_token,
  };

  if (response.refresh_token) {
    data.refreshToken = response.refresh_token;
  }

  if (response.expires_in !== undefined) {
    const expiresAt = new Date(Date.now() + response.expires_in * 1000);
    data.expiresAt = expiresAt.toISOString();
  }

  return data;
}

/**
 * Check if a token is expired or about to expire (within 5 minutes)
 */
export function isTokenExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) {
    // No expiration info — assume it's valid (Quire tokens last ~30 days)
    return false;
  }

  const expiresAtMs = new Date(expiresAt).getTime();
  const nowMs = Date.now();

  return nowMs >= expiresAtMs - TOKEN_EXPIRY_BUFFER_MS;
}

/**
 * Load OAuth config from environment variables.
 * Returns undefined if not configured.
 */
export function loadOAuthConfigFromEnv(): QuireOAuthConfig | undefined {
  const clientId = process.env["QUIRE_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["QUIRE_OAUTH_CLIENT_SECRET"];

  if (!clientId || !clientSecret) {
    return undefined;
  }

  const redirectUri =
    process.env["QUIRE_OAUTH_REDIRECT_URI"] ?? DEFAULT_REDIRECT_URI;

  return { clientId, clientSecret, redirectUri };
}
