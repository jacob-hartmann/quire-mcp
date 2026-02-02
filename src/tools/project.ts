/**
 * Project Tools
 *
 * MCP tools for managing Quire projects.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getQuireClient } from "../quire/client-factory.js";
import {
  formatError,
  formatAuthError,
  formatSuccess,
  formatMessage,
  buildParams,
} from "./utils.js";

/**
 * Register all project tools with the MCP server
 */
export function registerProjectTools(server: McpServer): void {
  // List Projects
  server.registerTool(
    "quire.listProjects",
    {
      description:
        "List all projects accessible to the current user. " +
        "Optionally filter by organization.",
      inputSchema: z.object({
        organizationId: z
          .string()
          .optional()
          .describe(
            "Filter projects by organization ID or OID (optional). " +
              "If not provided, returns all accessible projects."
          ),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ organizationId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.listProjects(organizationId);
      if (!result.success) {
        return formatError(result.error, "project");
      }

      return formatSuccess(result.data);
    }
  );

  // Get Project
  server.registerTool(
    "quire.getProject",
    {
      description:
        "Get detailed information about a specific project by its ID or OID. " +
        "Returns full project details including task counts, organization, and owner.",
      inputSchema: z.object({
        id: z
          .string()
          .describe(
            "The project ID (e.g., 'my-project') or OID (unique identifier)"
          ),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ id }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.getProject(id);
      if (!result.success) {
        return formatError(result.error, "project");
      }

      return formatSuccess(result.data);
    }
  );

  // Update Project
  server.registerTool(
    "quire.updateProject",
    {
      description:
        "Update a project's settings including name, description, and followers.",
      inputSchema: z.object({
        id: z
          .string()
          .describe(
            "The project ID (e.g., 'my-project') or OID (unique identifier)"
          ),
        name: z.string().optional().describe("New name for the project"),
        description: z
          .string()
          .optional()
          .describe("New description for the project"),
        archived: z
          .boolean()
          .optional()
          .describe("Whether the project is archived"),
        followers: z
          .array(z.string())
          .optional()
          .describe("Replace all followers with this list of user IDs"),
        addFollowers: z
          .array(z.string())
          .optional()
          .describe("User IDs to add as followers"),
        removeFollowers: z
          .array(z.string())
          .optional()
          .describe("User IDs to remove from followers"),
      }),
      annotations: {
        idempotentHint: true,
      },
    },
    async (
      {
        id,
        name,
        description,
        archived,
        followers,
        addFollowers,
        removeFollowers,
      },
      extra
    ) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({
        name,
        description,
        archived,
        followers,
        addFollowers,
        removeFollowers,
      });

      const result = await clientResult.client.updateProject(id, params);
      if (!result.success) {
        return formatError(result.error, "project");
      }

      return formatSuccess(result.data);
    }
  );

  // Export Project
  server.registerTool(
    "quire.exportProject",
    {
      description:
        "Export all tasks from a project in JSON or CSV format. " +
        "Useful for backups, analysis, or integrations. " +
        "Supports progress notifications for large exports when client provides a progressToken.",
      inputSchema: z.object({
        id: z
          .string()
          .describe(
            "The project ID (e.g., 'my-project') or OID (unique identifier)"
          ),
        format: z
          .enum(["json", "csv"])
          .default("json")
          .describe("Export format: 'json' (default) or 'csv'"),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ id, format }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      // Check if client requested progress tracking
      const progressToken = extra._meta?.progressToken;

      // Helper function to send progress notifications
      const sendProgress = async (
        progress: number,
        total: number,
        message?: string
      ): Promise<void> => {
        if (progressToken) {
          await extra.sendNotification({
            method: "notifications/progress",
            params: {
              progressToken,
              progress,
              total,
              ...(message && { message }),
            },
          });
        }
      };

      // Send initial progress
      await sendProgress(0, 100, "Starting project export...");

      const result = await clientResult.client.exportProject(id, format);

      // Send completion progress
      await sendProgress(100, 100, "Export complete");

      if (!result.success) {
        return formatError(result.error, "project");
      }

      // Format output based on export type
      if (format === "csv") {
        return formatMessage(result.data as string);
      }
      return formatSuccess(result.data);
    }
  );
}
