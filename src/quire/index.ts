/**
 * Quire API Module
 *
 * Exports the Quire API client, auth utilities, and types.
 */

export {
  QuireClient,
  createClientFromEnv,
  createClientFromAuth,
} from "./client.js";
export {
  getQuireClient,
  getQuireClientOrThrow,
  type QuireClientResult,
} from "./client-factory.js";
export type { QuireUser, QuireResult, QuireErrorCode } from "./types.js";
export { QuireClientError } from "./types.js";

// Auth exports
export { getQuireAccessToken, QuireAuthError } from "./auth.js";
export type { AuthResult } from "./auth.js";

// OAuth exports
export {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  isTokenExpired,
  loadOAuthConfigFromEnv,
  generateState,
  QuireOAuthError,
} from "./oauth.js";
export type { QuireTokenData, QuireOAuthConfig } from "./oauth.js";

// Token store exports
export {
  loadTokens,
  saveTokens,
  clearTokens,
  getTokenStorePath,
} from "./token-store.js";
