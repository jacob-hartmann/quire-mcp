/**
 * Status Tools
 *
 * MCP tools for managing Quire custom statuses.
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
 * Register all status tools with the MCP server
 */
export function registerStatusTools(server: McpServer): void {
  // List Statuses
  server.registerTool(
    "quire.listStatuses",
    {
      description:
        "List all custom statuses in a project. Returns an array of status objects " +
        "with value, name, and color. Default statuses (0=To-Do, 100=Complete) " +
        "are always available.",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ projectId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.listStatuses(projectId);
      if (!result.success) {
        return formatError(result.error, "status");
      }

      return formatSuccess(result.data);
    }
  );

  // Get Status
  server.registerTool(
    "quire.getStatus",
    {
      description:
        "Get detailed information about a specific custom status by its value.",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
        value: z.number().min(0).max(100).describe("The status value (0-100)"),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ projectId, value }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.getStatus(projectId, value);
      if (!result.success) {
        return formatError(result.error, "status");
      }

      return formatSuccess(result.data);
    }
  );

  // Create Status
  server.registerTool(
    "quire.createStatus",
    {
      description:
        "Create a custom status in a project. Custom statuses allow you to " +
        "define workflow stages beyond the default To-Do (0) and Complete (100).",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
        name: z.string().describe("The status name (required)"),
        value: z
          .number()
          .min(0)
          .max(100)
          .describe(
            "Status value (0-100, required). Values >= 100 are treated as completed. Must be unique within the project."
          ),
        color: z
          .string()
          .optional()
          .describe("Status color (hex code without #, e.g., 'ff5733')"),
      }),
    },
    async ({ projectId, name, value, color }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({ name, value, color });

      const result = await clientResult.client.createStatus(
        projectId,
        params as { name: string; value: number; color?: string }
      );
      if (!result.success) {
        return formatError(result.error, "status");
      }

      return formatSuccess(result.data);
    }
  );

  // Update Status
  server.registerTool(
    "quire.updateStatus",
    {
      description: "Update a custom status's name, value, or color.",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
        value: z
          .number()
          .min(0)
          .max(100)
          .describe("The current status value (0-100) to update"),
        name: z.string().optional().describe("New name for the status"),
        newValue: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe(
            "New numeric status value (0-100). Must be unique within the project."
          ),
        color: z
          .string()
          .optional()
          .describe("New color (hex code without #, e.g., 'ff5733')"),
      }),
      annotations: {
        idempotentHint: true,
      },
    },
    async ({ projectId, value, name, newValue, color }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({ name, value: newValue, color });

      const result = await clientResult.client.updateStatus(
        projectId,
        value,
        params
      );
      if (!result.success) {
        return formatError(result.error, "status");
      }

      return formatSuccess(result.data);
    }
  );

  // Delete Status
  server.registerTool(
    "quire.deleteStatus",
    {
      description:
        "Delete a custom status. Tasks with this status will be reverted to " +
        "the default To-Do status. You cannot delete the default statuses (0 and 100).",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
        value: z
          .number()
          .min(1)
          .max(99)
          .describe(
            "The status value (1-99) to delete. Cannot delete 0 (To-Do) or 100 (Complete)"
          ),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ projectId, value }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.deleteStatus(projectId, value);
      if (!result.success) {
        return formatError(result.error, "status");
      }

      return formatMessage(`Status with value ${value} deleted successfully.`);
    }
  );
}
