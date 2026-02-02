/**
 * quire://projects Resource
 *
 * Provides a list of all projects accessible to the current user.
 * This allows LLMs to explore available projects and their metadata.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getQuireClientOrThrow } from "../quire/client-factory.js";

const RESOURCE_URI = "quire://projects";

/**
 * Register the quire://projects resource
 */
export function registerProjectsResource(server: McpServer): void {
  server.registerResource(
    "projects",
    RESOURCE_URI,
    {
      description:
        "List of all Quire projects accessible to the current user. " +
        "Includes project IDs, names, descriptions, and other metadata.",
      mimeType: "application/json",
    },
    async (_uri, extra) => {
      // Get client using HTTP auth or fallback to stdio auth
      const client = await getQuireClientOrThrow(extra);

      // Fetch projects
      const result = await client.listProjects();
      if (!result.success) {
        throw new Error(
          `Failed to fetch projects: ${result.error.code} - ${result.error.message}`
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
