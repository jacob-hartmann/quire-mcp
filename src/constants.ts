/**
 * Shared Constants
 *
 * Centralized constants used across the application.
 */

// ---------------------------------------------------------------------------
// API URLs
// ---------------------------------------------------------------------------

/** Quire OAuth authorization endpoint */
export const QUIRE_OAUTH_AUTHORIZE_URL = "https://quire.io/oauth";

/** Quire OAuth token endpoint */
export const QUIRE_OAUTH_TOKEN_URL = "https://quire.io/oauth/token";

/** Quire API base URL */
export const QUIRE_API_BASE_URL = "https://quire.io/api";

// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------

/** Timeout for external API requests in milliseconds (30 seconds) */
export const FETCH_TIMEOUT_MS = 30_000;

/** Token expiry buffer in milliseconds (5 minutes) - refresh tokens before they expire */
export const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Server Configuration
// ---------------------------------------------------------------------------

/** Default HTTP server port */
export const DEFAULT_SERVER_PORT = "3001";

/** Default OAuth redirect URI for stdio mode */
export const DEFAULT_REDIRECT_URI = "http://localhost:3000/callback";

/** Number of characters to display from session IDs in logs */
export const SESSION_ID_DISPLAY_LENGTH = 8;

// ---------------------------------------------------------------------------
// JSON-RPC Error Codes
// ---------------------------------------------------------------------------

/** JSON-RPC error code: Invalid request */
export const JSONRPC_ERROR_INVALID_REQUEST = -32600;

/** JSON-RPC error code: Internal error */
export const JSONRPC_ERROR_INTERNAL = -32603;
