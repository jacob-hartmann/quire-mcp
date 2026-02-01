/**
 * Sublist Tools
 *
 * MCP tools for managing Quire sublists.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getQuireClient } from "../quire/client-factory.js";

interface ToolTextContent {
  type: "text";
  text: string;
}

interface ToolErrorResponse {
  [x: string]: unknown;
  isError: true;
  content: ToolTextContent[];
}

/**
 * Format error response for MCP tools
 */
function formatError(error: {
  code: string;
  message: string;
}): ToolErrorResponse {
  let errorMessage = error.message;

  switch (error.code) {
    case "UNAUTHORIZED":
      errorMessage =
        "Your access token is invalid or expired. " +
        "Delete the cached tokens and re-authorize via OAuth.";
      break;
    case "FORBIDDEN":
      errorMessage =
        "Your access token does not have permission to access this resource.";
      break;
    case "NOT_FOUND":
      errorMessage = "The requested sublist was not found.";
      break;
    case "RATE_LIMITED":
      errorMessage =
        "You have exceeded Quire's rate limit. " +
        "Please wait a moment before trying again.";
      break;
  }

  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: `Quire API Error (${error.code}): ${errorMessage}`,
      },
    ],
  };
}

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
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Authentication Error: ${clientResult.error}`,
            },
          ],
        };
      }

      const params: { name: string; description?: string } = { name };
      if (description !== undefined) params.description = description;

      const result = await clientResult.client.createSublist(
        ownerType,
        ownerId,
        params
      );
      if (!result.success) {
        return formatError(result.error);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
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
    },
    async ({ oid, ownerType, ownerId, sublistId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Authentication Error: ${clientResult.error}`,
            },
          ],
        };
      }

      // Validate input combinations
      if (!oid && (!ownerType || !ownerId || !sublistId)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'sublistId'",
            },
          ],
        };
      }

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
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Invalid parameters",
            },
          ],
        };
      }

      if (!result.success) {
        return formatError(result.error);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
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
    },
    async ({ ownerType, ownerId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Authentication Error: ${clientResult.error}`,
            },
          ],
        };
      }

      const result = await clientResult.client.listSublists(ownerType, ownerId);
      if (!result.success) {
        return formatError(result.error);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
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
    },
    async (
      { oid, ownerType, ownerId, sublistId, name, description },
      extra
    ) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Authentication Error: ${clientResult.error}`,
            },
          ],
        };
      }

      // Validate input combinations
      if (!oid && (!ownerType || !ownerId || !sublistId)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'sublistId'",
            },
          ],
        };
      }

      const params: { name?: string; description?: string } = {};
      if (name !== undefined) params.name = name;
      if (description !== undefined) params.description = description;

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
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Invalid parameters",
            },
          ],
        };
      }

      if (!result.success) {
        return formatError(result.error);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
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
    },
    async ({ oid, ownerType, ownerId, sublistId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Authentication Error: ${clientResult.error}`,
            },
          ],
        };
      }

      // Validate input combinations
      if (!oid && (!ownerType || !ownerId || !sublistId)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'sublistId'",
            },
          ],
        };
      }

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
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Invalid parameters",
            },
          ],
        };
      }

      if (!result.success) {
        return formatError(result.error);
      }

      const identifier = oid ?? `${ownerType}/${ownerId}/${sublistId}`;
      return {
        content: [
          {
            type: "text" as const,
            text: `Sublist ${identifier} deleted successfully.`,
          },
        ],
      };
    }
  );
}
