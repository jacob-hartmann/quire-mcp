/**
 * quire://project/{projectId}/tasks Resource Template
 *
 * Provides the list of root tasks in a specific project.
 * This allows LLMs to explore the task hierarchy.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getQuireClientOrThrow } from "../quire/client-factory.js";
import { createProjectIdCompleter } from "./completions.js";

/**
 * Register the quire://project/{projectId}/tasks resource template
 */
export function registerProjectTasksResource(server: McpServer): void {
  const template = new ResourceTemplate("quire://project/{projectId}/tasks", {
    list: undefined, // Tasks are accessed per-project
    complete: {
      projectId: createProjectIdCompleter(),
    },
  });

  server.registerResource(
    "project-tasks",
    template,
    {
      description:
        "List of root tasks in a specific Quire project. " +
        "Includes task names, statuses, priorities, and other metadata. " +
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

      // Fetch root tasks
      const result = await client.listTasks(projectId);
      if (!result.success) {
        throw new Error(
          `Failed to fetch tasks: ${result.error.code} - ${result.error.message}`
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
