/**
 * quire://project/{id} Resource Template
 *
 * Provides detailed information about a specific project.
 * This allows LLMs to access project metadata and settings.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getQuireClientOrThrow } from "../quire/client-factory.js";
import { createProjectIdCompleter } from "./completions.js";

/**
 * Register the quire://project/{id} resource template
 */
export function registerProjectResource(server: McpServer): void {
  const template = new ResourceTemplate("quire://project/{id}", {
    list: undefined, // Projects are listed via quire://projects
    complete: {
      id: createProjectIdCompleter(),
    },
  });

  server.registerResource(
    "project",
    template,
    {
      description:
        "Detailed information about a specific Quire project. " +
        "Includes project settings, members, and metadata. " +
        "The {id} parameter can be either the project ID (slug) or OID.",
      mimeType: "application/json",
    },
    async (uri, variables, extra) => {
      // Get client using HTTP auth or fallback to stdio auth
      const client = await getQuireClientOrThrow(extra);

      const projectId = variables["id"] as string;
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      // Fetch project details
      const result = await client.getProject(projectId);
      if (!result.success) {
        throw new Error(
          `Failed to fetch project: ${result.error.code} - ${result.error.message}`
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
