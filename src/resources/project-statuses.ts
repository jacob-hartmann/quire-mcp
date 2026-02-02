/**
 * quire://project/{projectId}/statuses Resource Template
 *
 * Provides the list of custom statuses in a specific project.
 * This allows LLMs to understand available workflow states.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getQuireClientOrThrow } from "../quire/client-factory.js";
import { createProjectIdCompleter } from "./completions.js";

/**
 * Register the quire://project/{projectId}/statuses resource template
 */
export function registerProjectStatusesResource(server: McpServer): void {
  const template = new ResourceTemplate(
    "quire://project/{projectId}/statuses",
    {
      list: undefined, // Statuses are accessed per-project
      complete: {
        projectId: createProjectIdCompleter(),
      },
    }
  );

  server.registerResource(
    "project-statuses",
    template,
    {
      description:
        "List of custom statuses in a specific Quire project. " +
        "Includes status names, values, colors, and other metadata. " +
        "The {projectId} parameter can be either the project ID (slug) or OID.",
      mimeType: "application/json",
    },
    async (uri, variables, extra) => {
      // Get client using HTTP auth or fallback to stdio auth
      const client = await getQuireClientOrThrow(extra);

      const projectId = variables["projectId"] as string;
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      // Fetch statuses
      const result = await client.listStatuses(projectId);
      if (!result.success) {
        throw new Error(
          `Failed to fetch statuses: ${result.error.code} - ${result.error.message}`
        );
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    }
  );
}
