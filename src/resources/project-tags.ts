/**
 * quire://project/{projectId}/tags Resource Template
 *
 * Provides the list of tags in a specific project.
 * This allows LLMs to understand available categorizations.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getQuireClientOrThrow } from "../quire/client-factory.js";
import { createProjectIdCompleter } from "./completions.js";

/**
 * Register the quire://project/{projectId}/tags resource template
 */
export function registerProjectTagsResource(server: McpServer): void {
  const template = new ResourceTemplate("quire://project/{projectId}/tags", {
    list: undefined, // Tags are accessed per-project
    complete: {
      projectId: createProjectIdCompleter(),
    },
  });

  server.registerResource(
    "project-tags",
    template,
    {
      description:
        "List of tags in a specific Quire project. " +
        "Includes tag names, colors, and other metadata. " +
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

      // Fetch tags
      const result = await client.listTags(projectId);
      if (!result.success) {
        throw new Error(
          `Failed to fetch tags: ${result.error.code} - ${result.error.message}`
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
