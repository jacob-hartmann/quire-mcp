/**
 * Document Tools
 *
 * MCP tools for managing Quire documents.
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
      errorMessage = "The requested document was not found.";
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
 * Register all document tools with the MCP server
 */
export function registerDocumentTools(server: McpServer): void {
  // Create Document
  server.registerTool(
    "quire.createDocument",
    {
      description: "Create a new document in an organization or project.",
      inputSchema: z.object({
        ownerType: z
          .enum(["organization", "project"])
          .describe("The type of owner: 'organization' or 'project'"),
        ownerId: z
          .string()
          .describe("The owner ID (e.g., 'my-org' or 'my-project') or OID"),
        name: z.string().describe("The document name/title"),
        content: z
          .string()
          .optional()
          .describe("The document content in markdown format"),
      }),
    },
    async ({ ownerType, ownerId, name, content }, extra) => {
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

      const params: { name: string; content?: string } = { name };
      if (content !== undefined) params.content = content;

      const result = await clientResult.client.createDocument(
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

  // Get Document
  server.registerTool(
    "quire.getDocument",
    {
      description:
        "Get a document by OID, or by owner type/ID and document ID.",
      inputSchema: z.object({
        oid: z
          .string()
          .optional()
          .describe(
            "The document OID (unique identifier). Use this OR ownerType+ownerId+documentId"
          ),
        ownerType: z
          .enum(["organization", "project"])
          .optional()
          .describe("The type of owner (required when using documentId)"),
        ownerId: z
          .string()
          .optional()
          .describe("The owner ID or OID (required when using documentId)"),
        documentId: z
          .string()
          .optional()
          .describe("The document ID within the owner"),
      }),
    },
    async ({ oid, ownerType, ownerId, documentId }, extra) => {
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
      if (!oid && (!ownerType || !ownerId || !documentId)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'documentId'",
            },
          ],
        };
      }

      let result;
      if (oid) {
        result = await clientResult.client.getDocument(oid);
      } else if (ownerType && ownerId && documentId) {
        result = await clientResult.client.getDocument(
          ownerType,
          ownerId,
          documentId
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

  // List Documents
  server.registerTool(
    "quire.listDocuments",
    {
      description: "List all documents in an organization or project.",
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

      const result = await clientResult.client.listDocuments(
        ownerType,
        ownerId
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

  // Update Document
  server.registerTool(
    "quire.updateDocument",
    {
      description:
        "Update a document's name or content by OID, or by owner type/ID and document ID.",
      inputSchema: z.object({
        oid: z
          .string()
          .optional()
          .describe(
            "The document OID (unique identifier). Use this OR ownerType+ownerId+documentId"
          ),
        ownerType: z
          .enum(["organization", "project"])
          .optional()
          .describe("The type of owner (required when using documentId)"),
        ownerId: z
          .string()
          .optional()
          .describe("The owner ID or OID (required when using documentId)"),
        documentId: z
          .string()
          .optional()
          .describe("The document ID within the owner"),
        name: z.string().optional().describe("New document name/title"),
        content: z
          .string()
          .optional()
          .describe("New document content in markdown format"),
      }),
    },
    async ({ oid, ownerType, ownerId, documentId, name, content }, extra) => {
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
      if (!oid && (!ownerType || !ownerId || !documentId)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'documentId'",
            },
          ],
        };
      }

      const params: { name?: string; content?: string } = {};
      if (name !== undefined) params.name = name;
      if (content !== undefined) params.content = content;

      let result;
      if (oid) {
        result = await clientResult.client.updateDocument(oid, params);
      } else if (ownerType && ownerId && documentId) {
        result = await clientResult.client.updateDocument(
          ownerType,
          ownerId,
          documentId,
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

  // Delete Document
  server.registerTool(
    "quire.deleteDocument",
    {
      description:
        "Delete a document by OID, or by owner type/ID and document ID. This action cannot be undone.",
      inputSchema: z.object({
        oid: z
          .string()
          .optional()
          .describe(
            "The document OID (unique identifier). Use this OR ownerType+ownerId+documentId"
          ),
        ownerType: z
          .enum(["organization", "project"])
          .optional()
          .describe("The type of owner (required when using documentId)"),
        ownerId: z
          .string()
          .optional()
          .describe("The owner ID or OID (required when using documentId)"),
        documentId: z
          .string()
          .optional()
          .describe("The document ID within the owner to delete"),
      }),
    },
    async ({ oid, ownerType, ownerId, documentId }, extra) => {
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
      if (!oid && (!ownerType || !ownerId || !documentId)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'documentId'",
            },
          ],
        };
      }

      let result;
      if (oid) {
        result = await clientResult.client.deleteDocument(oid);
      } else if (ownerType && ownerId && documentId) {
        result = await clientResult.client.deleteDocument(
          ownerType,
          ownerId,
          documentId
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

      const identifier = oid ?? `${ownerType}/${ownerId}/${documentId}`;
      return {
        content: [
          {
            type: "text" as const,
            text: `Document ${identifier} deleted successfully.`,
          },
        ],
      };
    }
  );
}
