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
      description:
        "Create a new sublist in an organization, project, folder, or smart-folder.",
      inputSchema: z.object({
        ownerType: z
          .enum(["organization", "project", "folder", "smart-folder"])
          .describe(
            "The type of owner: 'organization', 'project', 'folder', or 'smart-folder'"
          ),
        ownerId: z
          .string()
          .describe("The owner ID (e.g., 'my-org' or 'my-project') or OID"),
        name: z.string().describe("The sublist name"),
        id: z
          .string()
          .optional()
          .describe(
            "Custom ID for this sublist. If omitted, Quire generates one automatically. Must be unique within the project."
          ),
        description: z.string().optional().describe("The sublist description"),
        includes: z
          .array(z.string())
          .optional()
          .describe(
            "List of task OIDs to include in this sublist. All descendants of the specified tasks will be included as well."
          ),
        iconColor: z
          .string()
          .optional()
          .describe("Icon color index from Quire's predefined palette"),
        image: z
          .string()
          .optional()
          .describe(
            "Icon image identifier (e.g., 'icon-view-list', 'icon-briefcase-o', etc.)"
          ),
        partner: z
          .string()
          .optional()
          .describe("OID of the external team this sublist belongs to"),
        start: z
          .string()
          .optional()
          .describe("Target start date (ISO 8601 format, e.g., '2024-01-02')"),
        due: z
          .string()
          .optional()
          .describe("Target due date (ISO 8601 format, e.g., '2024-05-25')"),
      }),
    },
    async (
      {
        ownerType,
        ownerId,
        name,
        id,
        description,
        includes,
        iconColor,
        image,
        partner,
        start,
        due,
      },
      extra
    ) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({
        name,
        id,
        description,
        includes,
        iconColor,
        image,
        partner,
        start,
        due,
      });

      const result = await clientResult.client.createSublist(
        ownerType as "organization" | "project",
        ownerId,
        params as { name: string }
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
          .enum(["organization", "project", "folder", "smart-folder"])
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
          ownerType as "organization" | "project",
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
      description:
        "List all sublists in an organization, project, folder, or smart-folder.",
      inputSchema: z.object({
        ownerType: z
          .enum(["organization", "project", "folder", "smart-folder"])
          .describe(
            "The type of owner: 'organization', 'project', 'folder', or 'smart-folder'"
          ),
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

      const result = await clientResult.client.listSublists(
        ownerType as "organization" | "project",
        ownerId
      );
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
        "Update a sublist's properties by OID, or by owner type/ID and sublist ID.",
      inputSchema: z.object({
        oid: z
          .string()
          .optional()
          .describe(
            "The sublist OID (unique identifier). Use this OR ownerType+ownerId+sublistId"
          ),
        ownerType: z
          .enum(["organization", "project", "folder", "smart-folder"])
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
        id: z.string().optional().describe("New ID for this sublist"),
        description: z.string().optional().describe("New sublist description"),
        changes: z
          .array(
            z.object({
              task: z
                .string()
                .describe("Task OID to add or remove from sublist"),
              exclude: z
                .boolean()
                .describe("If true, removes the task; if false, adds the task"),
              single: z
                .boolean()
                .describe(
                  "If true, affects only the task; if false, includes descendants"
                ),
            })
          )
          .optional()
          .describe("List of changes to add or remove tasks from this sublist"),
        iconColor: z
          .string()
          .optional()
          .describe("Icon color index from Quire's predefined palette"),
        archived: z
          .boolean()
          .optional()
          .describe(
            "Archive toggle. Specify true to archive; false to unarchive"
          ),
        start: z
          .string()
          .optional()
          .describe("Target start date (ISO 8601 format, e.g., '2024-01-02')"),
        due: z
          .string()
          .optional()
          .describe("Target due date (ISO 8601 format, e.g., '2024-05-25')"),
        image: z
          .string()
          .optional()
          .describe(
            "Icon image identifier (e.g., 'icon-view-list', 'icon-briefcase-o', etc.)"
          ),
      }),
      annotations: {
        idempotentHint: true,
      },
    },
    async (
      {
        oid,
        ownerType,
        ownerId,
        sublistId,
        name,
        id,
        description,
        changes,
        iconColor,
        archived,
        start,
        due,
        image,
      },
      extra
    ) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({
        name,
        id,
        description,
        changes,
        iconColor,
        archived,
        start,
        due,
        image,
      });

      // Update sublist by OID or by ownerType + ownerId + sublistId
      let result;
      if (oid) {
        result = await clientResult.client.updateSublist(oid, params);
      } else if (ownerType && ownerId && sublistId) {
        result = await clientResult.client.updateSublist(
          ownerType as "organization" | "project",
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
          .enum(["organization", "project", "folder", "smart-folder"])
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
          ownerType as "organization" | "project",
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
