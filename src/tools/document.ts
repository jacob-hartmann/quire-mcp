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
          .enum(["organization", "project", "folder", "smart-folder"])
          .describe(
            "The type of owner: 'organization', 'project', 'folder', or 'smart-folder'"
          ),
        ownerId: z
          .string()
          .describe("The owner ID (e.g., 'my-org' or 'my-project') or OID"),
        name: z.string().describe("The document name/title"),
        id: z
          .string()
          .optional()
          .describe(
            "Custom ID for this document. If omitted, Quire generates one automatically. Must be unique within the project."
          ),
        description: z
          .string()
          .optional()
          .describe("The document content in markdown format"),
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
          .describe("OID of the external team this document belongs to"),
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
        iconColor,
        image,
        partner,
        start,
        due,
      });

      const result = await clientResult.client.createDocument(
        ownerType as "organization" | "project",
        ownerId,
        params as { name: string }
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
          .enum(["organization", "project", "folder", "smart-folder"])
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
      annotations: {
        readOnlyHint: true,
      },
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
          ownerType as "organization" | "project",
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
      description:
        "List all documents in an organization, project, folder, or smart-folder.",
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

      const result = await clientResult.client.listDocuments(
        ownerType as "organization" | "project",
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
        "Update a document's properties by OID, or by owner type/ID and document ID.",
      inputSchema: z.object({
        oid: z
          .string()
          .optional()
          .describe(
            "The document OID (unique identifier). Use this OR ownerType+ownerId+documentId"
          ),
        ownerType: z
          .enum(["organization", "project", "folder", "smart-folder"])
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
        id: z.string().optional().describe("New ID for this document"),
        description: z
          .string()
          .optional()
          .describe("New document content in markdown format"),
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
        documentId,
        name,
        id,
        description,
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
        iconColor,
        archived,
        start,
        due,
        image,
      });

      // Update document by OID or by ownerType + ownerId + documentId
      let result;
      if (oid) {
        result = await clientResult.client.updateDocument(oid, params);
      } else if (ownerType && ownerId && documentId) {
        result = await clientResult.client.updateDocument(
          ownerType as "organization" | "project",
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
          .enum(["organization", "project", "folder", "smart-folder"])
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
      annotations: {
        destructiveHint: true,
      },
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
          ownerType as "organization" | "project",
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
