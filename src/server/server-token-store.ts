/**
 * Server Token Store
 *
 * In-memory storage for OAuth authorization codes and tokens.
 * This is used by the proxy OAuth provider to store:
 * - Pending authorization requests (PKCE challenges, redirect URIs)
 * - Authorization codes mapped to Quire tokens
 * - Access tokens issued by our server that wrap Quire tokens
 */

import { randomBytes, createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Pending authorization request (before user completes Quire auth)
 */
export interface PendingAuthRequest {
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: "S256" | "plain";
  redirectUri: string;
  scope: string | undefined;
  createdAt: number;
}

/**
 * Authorization code entry (after user completes Quire auth)
 */
export interface AuthCodeEntry {
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: "S256" | "plain";
  redirectUri: string;
  quireAccessToken: string;
  quireRefreshToken: string | undefined;
  scope: string | undefined;
  createdAt: number;
  expiresAt: number;
}

/**
 * Access token entry (after code exchange)
 */
export interface TokenEntry {
  quireAccessToken: string;
  quireRefreshToken: string | undefined;
  clientId: string;
  scope: string | undefined;
  createdAt: number;
  expiresAt: number;
}

/**
 * Refresh token entry
 */
export interface RefreshTokenEntry {
  quireRefreshToken: string;
  clientId: string;
  scope: string | undefined;
  createdAt: number;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Authorization code expiry in seconds (10 minutes) */
const AUTH_CODE_EXPIRY_SECONDS = 600;

/** Access token expiry in seconds (1 hour) */
const ACCESS_TOKEN_EXPIRY_SECONDS = 3600;

/** Pending request expiry in seconds (10 minutes) */
const PENDING_REQUEST_EXPIRY_SECONDS = 600;

/** Refresh token expiry in seconds (30 days) */
const REFRESH_TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Server Token Store
// ---------------------------------------------------------------------------

/**
 * In-memory token store for the OAuth proxy server
 */
export class ServerTokenStore {
  /** Pending auth requests indexed by state */
  private pendingRequests = new Map<string, PendingAuthRequest>();

  /** Authorization codes indexed by code */
  private authCodes = new Map<string, AuthCodeEntry>();

  /** Access tokens indexed by token */
  private accessTokens = new Map<string, TokenEntry>();

  /** Refresh tokens indexed by token */
  private refreshTokens = new Map<string, RefreshTokenEntry>();

  // -------------------------------------------------------------------------
  // Pending Authorization Requests
  // -------------------------------------------------------------------------

  /**
   * Store a pending authorization request.
   * Returns the state parameter to use for Quire OAuth.
   */
  storePendingRequest(request: Omit<PendingAuthRequest, "createdAt">): string {
    const state = this.generateSecureToken();
    this.pendingRequests.set(state, {
      ...request,
      createdAt: Date.now(),
    });
    return state;
  }

  /**
   * Get and remove a pending request by state.
   * Returns undefined if not found or expired.
   */
  consumePendingRequest(state: string): PendingAuthRequest | undefined {
    const request = this.pendingRequests.get(state);
    if (!request) {
      return undefined;
    }

    this.pendingRequests.delete(state);

    // Check if expired
    const expiresAt = request.createdAt + PENDING_REQUEST_EXPIRY_SECONDS * 1000;
    if (Date.now() > expiresAt) {
      return undefined;
    }

    return request;
  }

  // -------------------------------------------------------------------------
  // Authorization Codes
  // -------------------------------------------------------------------------

  /**
   * Store an authorization code with associated data.
   * Returns the authorization code.
   */
  storeAuthCode(data: Omit<AuthCodeEntry, "createdAt" | "expiresAt">): string {
    const code = this.generateSecureToken();
    const now = Date.now();
    this.authCodes.set(code, {
      ...data,
      createdAt: now,
      expiresAt: now + AUTH_CODE_EXPIRY_SECONDS * 1000,
    });
    return code;
  }

  /**
   * Get an authorization code entry (does not consume it).
   * Used for PKCE challenge lookup.
   */
  getAuthCode(code: string): AuthCodeEntry | undefined {
    const entry = this.authCodes.get(code);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.authCodes.delete(code);
      return undefined;
    }

    return entry;
  }

  /**
   * Get and remove an authorization code.
   * Returns undefined if not found or expired.
   */
  consumeAuthCode(code: string): AuthCodeEntry | undefined {
    const entry = this.getAuthCode(code);
    if (entry) {
      this.authCodes.delete(code);
    }
    return entry;
  }

  // -------------------------------------------------------------------------
  // Access Tokens
  // -------------------------------------------------------------------------

  /**
   * Store an access token with associated data.
   * Returns the access token.
   */
  storeAccessToken(data: Omit<TokenEntry, "createdAt" | "expiresAt">): {
    accessToken: string;
    expiresIn: number;
  } {
    const token = this.generateSecureToken();
    const now = Date.now();
    this.accessTokens.set(token, {
      ...data,
      createdAt: now,
      expiresAt: now + ACCESS_TOKEN_EXPIRY_SECONDS * 1000,
    });
    return { accessToken: token, expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS };
  }

  /**
   * Validate and get token entry.
   * Returns undefined if not found or expired.
   */
  getAccessToken(token: string): TokenEntry | undefined {
    const entry = this.accessTokens.get(token);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.accessTokens.delete(token);
      return undefined;
    }

    return entry;
  }

  /**
   * Revoke an access token
   */
  revokeAccessToken(token: string): boolean {
    return this.accessTokens.delete(token);
  }

  // -------------------------------------------------------------------------
  // Refresh Tokens
  // -------------------------------------------------------------------------

  /**
   * Store a refresh token.
   * Returns the refresh token.
   */
  storeRefreshToken(
    data: Omit<RefreshTokenEntry, "createdAt" | "expiresAt">
  ): string {
    const token = this.generateSecureToken();
    const now = Date.now();
    this.refreshTokens.set(token, {
      ...data,
      createdAt: now,
      expiresAt: now + REFRESH_TOKEN_EXPIRY_SECONDS * 1000,
    });
    return token;
  }

  /**
   * Get refresh token entry.
   * Returns undefined if not found or expired.
   */
  getRefreshToken(token: string): RefreshTokenEntry | undefined {
    const entry = this.refreshTokens.get(token);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.refreshTokens.delete(token);
      return undefined;
    }

    return entry;
  }

  /**
   * Revoke a refresh token
   */
  revokeRefreshToken(token: string): boolean {
    return this.refreshTokens.delete(token);
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /**
   * Generate a cryptographically secure random token
   */
  private generateSecureToken(): string {
    return randomBytes(32).toString("base64url");
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now();

    // Clean pending requests
    for (const [state, request] of this.pendingRequests) {
      const expiresAt =
        request.createdAt + PENDING_REQUEST_EXPIRY_SECONDS * 1000;
      if (now > expiresAt) {
        this.pendingRequests.delete(state);
      }
    }

    // Clean auth codes
    for (const [code, entry] of this.authCodes) {
      if (now > entry.expiresAt) {
        this.authCodes.delete(code);
      }
    }

    // Clean access tokens
    for (const [token, entry] of this.accessTokens) {
      if (now > entry.expiresAt) {
        this.accessTokens.delete(token);
      }
    }

    // Clean refresh tokens
    for (const [token, entry] of this.refreshTokens) {
      if (now > entry.expiresAt) {
        this.refreshTokens.delete(token);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// PKCE Utilities
// ---------------------------------------------------------------------------

/**
 * Verify a PKCE code verifier against a code challenge
 */
export function verifyPkceChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: "S256" | "plain"
): boolean {
  if (method === "plain") {
    return codeVerifier === codeChallenge;
  }

  // S256: base64url(sha256(code_verifier)) === code_challenge
  const hash = createHash("sha256").update(codeVerifier).digest();
  const computed = hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return computed === codeChallenge;
}

// ---------------------------------------------------------------------------
// Singleton Instance
// ---------------------------------------------------------------------------

let storeInstance: ServerTokenStore | undefined;

/**
 * Get the singleton token store instance
 */
export function getServerTokenStore(): ServerTokenStore {
  storeInstance ??= new ServerTokenStore();
  return storeInstance;
}
