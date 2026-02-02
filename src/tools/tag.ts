/**
 * Tag Tools
 *
 * MCP tools for managing Quire tags.
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
 * Register all tag tools with the MCP server
 */
export function registerTagTools(server: McpServer): void {
  // List Tags
  server.registerTool(
    "quire.listTags",
    {
      description:
        "List all tags in a project. Returns an array of tag objects " +
        "with name, color, and identifiers.",
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

      const result = await clientResult.client.listTags(projectId);
      if (!result.success) {
        return formatError(result.error, "tag");
      }

      return formatSuccess(result.data);
    }
  );

  // Get Tag
  server.registerTool(
    "quire.getTag",
    {
      description: "Get detailed information about a specific tag by its OID.",
      inputSchema: z.object({
        oid: z.string().describe("The tag OID (unique identifier)"),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ oid }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.getTag(oid);
      if (!result.success) {
        return formatError(result.error, "tag");
      }

      return formatSuccess(result.data);
    }
  );

  // Create Tag
  server.registerTool(
    "quire.createTag",
    {
      description:
        "Create a new tag in a project. Tags help organize and categorize tasks.",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
        name: z.string().describe("The tag name (required)"),
        color: z
          .string()
          .optional()
          .describe("Tag color (hex code without #, e.g., 'ff5733')"),
      }),
    },
    async ({ projectId, name, color }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({ name, color });

      const result = await clientResult.client.createTag(
        projectId,
        params as { name: string; color?: string }
      );
      if (!result.success) {
        return formatError(result.error, "tag");
      }

      return formatSuccess(result.data);
    }
  );

  // Update Tag
  server.registerTool(
    "quire.updateTag",
    {
      description: "Update a tag's name or color.",
      inputSchema: z.object({
        oid: z.string().describe("The tag OID (unique identifier)"),
        name: z.string().optional().describe("New name for the tag"),
        color: z
          .string()
          .optional()
          .describe("New color (hex code without #, e.g., 'ff5733')"),
      }),
      annotations: {
        idempotentHint: true,
      },
    },
    async ({ oid, name, color }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({ name, color });

      const result = await clientResult.client.updateTag(oid, params);
      if (!result.success) {
        return formatError(result.error, "tag");
      }

      return formatSuccess(result.data);
    }
  );

  // Delete Tag
  server.registerTool(
    "quire.deleteTag",
    {
      description:
        "Delete a tag. This will remove the tag from all tasks that have it.",
      inputSchema: z.object({
        oid: z.string().describe("The tag OID (unique identifier) to delete"),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ oid }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.deleteTag(oid);
      if (!result.success) {
        return formatError(result.error, "tag");
      }

      return formatMessage(`Tag ${oid} deleted successfully.`);
    }
  );
}
