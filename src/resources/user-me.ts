/**
 * quire://user/me Resource
 *
 * Provides the current authenticated user's profile data as a resource.
 * This allows LLMs to include user context in their reasoning.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getQuireClientOrThrow } from "../quire/client-factory.js";

const RESOURCE_URI = "quire://user/me";

/**
 * Register the quire://user/me resource
 */
export function registerUserMeResource(server: McpServer): void {
  // Register the resource in the list
  server.registerResource(
    "user-me",
    RESOURCE_URI,
    {
      description:
        "The current authenticated Quire user's profile data. " +
        "Includes name, email, timezone, and other account information.",
      mimeType: "application/json",
    },
    async (_uri, extra) => {
      // Get client using HTTP auth or fallback to stdio auth
      const client = await getQuireClientOrThrow(extra);

      // Fetch user profile
      const userResult = await client.getMe();
      if (!userResult.success) {
        throw new Error(
          `Failed to fetch user: ${userResult.error.code} - ${userResult.error.message}`
        );
      }

      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: "application/json",
            text: JSON.stringify(userResult.data, null, 2),
          },
        ],
      };
    }
  );
}
