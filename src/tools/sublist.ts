/**
 * Sublist Tools
 *
 * MCP tools for managing Quire sublists.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getQuireClient } from "../quire/client-factory.js";
import {
  formatError,
  formatAuthError,
  formatSuccess,
  formatMessage,
  formatValidationError,
  buildParams,
} from "./utils.js";

/**
 * Register all sublist tools with the MCP server
 */
export function registerSublistTools(server: McpServer): void {
  // Create Sublist
  server.registerTool(
    "quire.createSublist",
    {
      description: "Create a new sublist in an organization or project.",
      inputSchema: z.object({
        ownerType: z
          .enum(["organization", "project"])
          .describe("The type of owner: 'organization' or 'project'"),
        ownerId: z
          .string()
          .describe("The owner ID (e.g., 'my-org' or 'my-project') or OID"),
        name: z.string().describe("The sublist name"),
        description: z.string().optional().describe("The sublist description"),
      }),
    },
    async ({ ownerType, ownerId, name, description }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({ name, description });

      const result = await clientResult.client.createSublist(
        ownerType,
        ownerId,
        params as { name: string; description?: string }
      );
      if (!result.success) {
        return formatError(result.error, "sublist");
      }

      return formatSuccess(result.data);
    }
  );

  // Get Sublist
  server.registerTool(
    "quire.getSublist",
    {
      description: "Get a sublist by OID, or by owner type/ID and sublist ID.",
      inputSchema: z.object({
        oid: z
          .string()
          .optional()
          .describe(
            "The sublist OID (unique identifier). Use this OR ownerType+ownerId+sublistId"
          ),
        ownerType: z
          .enum(["organization", "project"])
          .optional()
          .describe("The type of owner (required when using sublistId)"),
        ownerId: z
          .string()
          .optional()
          .describe("The owner ID or OID (required when using sublistId)"),
        sublistId: z
          .string()
          .optional()
          .describe("The sublist ID within the owner"),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ oid, ownerType, ownerId, sublistId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      // Get sublist by OID or by ownerType + ownerId + sublistId
      let result;
      if (oid) {
        result = await clientResult.client.getSublist(oid);
      } else if (ownerType && ownerId && sublistId) {
        result = await clientResult.client.getSublist(
          ownerType,
          ownerId,
          sublistId
        );
      } else {
        return formatValidationError(
          "Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'sublistId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "sublist");
      }

      return formatSuccess(result.data);
    }
  );

  // List Sublists
  server.registerTool(
    "quire.listSublists",
    {
      description: "List all sublists in an organization or project.",
      inputSchema: z.object({
        ownerType: z
          .enum(["organization", "project"])
          .describe("The type of owner: 'organization' or 'project'"),
        ownerId: z
          .string()
          .describe("The owner ID (e.g., 'my-org' or 'my-project') or OID"),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ ownerType, ownerId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.listSublists(ownerType, ownerId);
      if (!result.success) {
        return formatError(result.error, "sublist");
      }

      return formatSuccess(result.data);
    }
  );

  // Update Sublist
  server.registerTool(
    "quire.updateSublist",
    {
      description:
        "Update a sublist's name or description by OID, or by owner type/ID and sublist ID.",
      inputSchema: z.object({
        oid: z
          .string()
          .optional()
          .describe(
            "The sublist OID (unique identifier). Use this OR ownerType+ownerId+sublistId"
          ),
        ownerType: z
          .enum(["organization", "project"])
          .optional()
          .describe("The type of owner (required when using sublistId)"),
        ownerId: z
          .string()
          .optional()
          .describe("The owner ID or OID (required when using sublistId)"),
        sublistId: z
          .string()
          .optional()
          .describe("The sublist ID within the owner"),
        name: z.string().optional().describe("New sublist name"),
        description: z.string().optional().describe("New sublist description"),
      }),
      annotations: {
        idempotentHint: true,
      },
    },
    async (
      { oid, ownerType, ownerId, sublistId, name, description },
      extra
    ) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({ name, description });

      // Update sublist by OID or by ownerType + ownerId + sublistId
      let result;
      if (oid) {
        result = await clientResult.client.updateSublist(oid, params);
      } else if (ownerType && ownerId && sublistId) {
        result = await clientResult.client.updateSublist(
          ownerType,
          ownerId,
          sublistId,
          params
        );
      } else {
        return formatValidationError(
          "Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'sublistId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "sublist");
      }

      return formatSuccess(result.data);
    }
  );

  // Delete Sublist
  server.registerTool(
    "quire.deleteSublist",
    {
      description:
        "Delete a sublist by OID, or by owner type/ID and sublist ID. This action cannot be undone.",
      inputSchema: z.object({
        oid: z
          .string()
          .optional()
          .describe(
            "The sublist OID (unique identifier). Use this OR ownerType+ownerId+sublistId"
          ),
        ownerType: z
          .enum(["organization", "project"])
          .optional()
          .describe("The type of owner (required when using sublistId)"),
        ownerId: z
          .string()
          .optional()
          .describe("The owner ID or OID (required when using sublistId)"),
        sublistId: z
          .string()
          .optional()
          .describe("The sublist ID within the owner to delete"),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ oid, ownerType, ownerId, sublistId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      // Delete sublist by OID or by ownerType + ownerId + sublistId
      let result;
      if (oid) {
        result = await clientResult.client.deleteSublist(oid);
      } else if (ownerType && ownerId && sublistId) {
        result = await clientResult.client.deleteSublist(
          ownerType,
          ownerId,
          sublistId
        );
      } else {
        return formatValidationError(
          "Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'sublistId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "sublist");
      }

      const identifier = oid ?? `${ownerType}/${ownerId}/${sublistId}`;
      return formatMessage(`Sublist ${identifier} deleted successfully.`);
    }
  );
}
