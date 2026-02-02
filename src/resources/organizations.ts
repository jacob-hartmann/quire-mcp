/**
 * quire://organizations Resource
 *
 * Provides a list of all organizations accessible to the current user.
 * This allows LLMs to explore available organizations and their metadata.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getQuireClientOrThrow } from "../quire/client-factory.js";

const RESOURCE_URI = "quire://organizations";

/**
 * Register the quire://organizations resource
 */
export function registerOrganizationsResource(server: McpServer): void {
  server.registerResource(
    "organizations",
    RESOURCE_URI,
    {
      description:
        "List of all Quire organizations accessible to the current user. " +
        "Includes organization IDs, names, and other metadata.",
      mimeType: "application/json",
    },
    async (_uri, extra) => {
      // Get client using HTTP auth or fallback to stdio auth
      const client = await getQuireClientOrThrow(extra);

      // Fetch organizations
      const result = await client.listOrganizations();
      if (!result.success) {
        throw new Error(
          `Failed to fetch organizations: ${result.error.code} - ${result.error.message}`
        );
      }

      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: "application/json",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    }
  );
}
