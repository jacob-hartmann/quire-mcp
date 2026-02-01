/**
 * Quire Client Factory
 *
 * Shared factory for creating QuireClient instances from MCP request context.
 * Used by both tools and resources to avoid code duplication.
 */

import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  ServerRequest,
  ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import { QuireClient, createClientFromAuth } from "./client.js";

/**
 * Result type for getQuireClient - allows callers to handle errors gracefully
 */
export type QuireClientResult =
  | { success: true; client: QuireClient }
  | { success: false; error: string };

/**
 * Get a QuireClient from MCP request context.
 *
 * In HTTP mode, the Quire token is passed via authInfo.extra.quireToken.
 * In stdio mode, falls back to env var or interactive OAuth.
 *
 * @param extra - MCP request handler extra context
 * @returns Result with client or error message
 */
export async function getQuireClient(
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
): Promise<QuireClientResult> {
  // In HTTP mode, the Quire token is passed via authInfo.extra.quireToken
  const quireToken = extra.authInfo?.extra?.["quireToken"];

  if (typeof quireToken === "string" && quireToken.length > 0) {
    return { success: true, client: new QuireClient({ token: quireToken }) };
  }

  // Fallback to stdio mode auth (env var or interactive OAuth)
  const clientResult = await createClientFromAuth();
  if (!clientResult.success) {
    return { success: false, error: clientResult.error.message };
  }
  return { success: true, client: clientResult.data };
}

/**
 * Get a QuireClient, throwing on error.
 *
 * Use this variant when errors should propagate as exceptions (e.g., resources).
 *
 * @param extra - MCP request handler extra context
 * @returns QuireClient instance
 * @throws Error if client cannot be created
 */
export async function getQuireClientOrThrow(
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
): Promise<QuireClient> {
  const result = await getQuireClient(extra);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.client;
}
