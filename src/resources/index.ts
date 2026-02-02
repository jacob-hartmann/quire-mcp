/**
 * MCP Resources Registration
 *
 * Registers all available resources with the MCP server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerUserMeResource } from "./user-me.js";
import { registerOrganizationsResource } from "./organizations.js";
import { registerProjectsResource } from "./projects.js";
import { registerProjectResource } from "./project.js";
import { registerProjectTasksResource } from "./project-tasks.js";
import { registerProjectTagsResource } from "./project-tags.js";
import { registerProjectStatusesResource } from "./project-statuses.js";

/**
 * Register all resources with the MCP server
 */
export function registerResources(server: McpServer): void {
  // Static resources
  registerUserMeResource(server);
  registerOrganizationsResource(server);
  registerProjectsResource(server);

  // Resource templates
  registerProjectResource(server);
  registerProjectTasksResource(server);
  registerProjectTagsResource(server);
  registerProjectStatusesResource(server);
}
