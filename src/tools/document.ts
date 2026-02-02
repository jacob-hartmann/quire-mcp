/**
 * Document Tools
 *
 * MCP tools for managing Quire documents.
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
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({ name, content });

      const result = await clientResult.client.createDocument(
        ownerType,
        ownerId,
        params as { name: string; content?: string }
      );
      if (!result.success) {
        return formatError(result.error, "document");
      }

      return formatSuccess(result.data);
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
        return formatAuthError(clientResult.error);
      }

      // Get document by OID or by ownerType + ownerId + documentId
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
        return formatValidationError(
          "Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'documentId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "document");
      }

      return formatSuccess(result.data);
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
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.listDocuments(
        ownerType,
        ownerId
      );
      if (!result.success) {
        return formatError(result.error, "document");
      }

      return formatSuccess(result.data);
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
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({ name, content });

      // Update document by OID or by ownerType + ownerId + documentId
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
        return formatValidationError(
          "Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'documentId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "document");
      }

      return formatSuccess(result.data);
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
        return formatAuthError(clientResult.error);
      }

      // Delete document by OID or by ownerType + ownerId + documentId
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
        return formatValidationError(
          "Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'documentId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "document");
      }

      const identifier = oid ?? `${ownerType}/${ownerId}/${documentId}`;
      return formatMessage(`Document ${identifier} deleted successfully.`);
    }
  );
}
