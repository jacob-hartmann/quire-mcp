/**
 * Test Utilities for Tool Tests
 *
 * Shared mock factories and utilities for testing MCP tools.
 */

import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  ServerRequest,
  ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import type { QuireClient } from "../quire/client.js";
import { QuireClientError } from "../quire/types.js";

export type MockExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/**
 * Create a mock RequestHandlerExtra for testing
 */
export function createMockExtra(options?: { quireToken?: string }): MockExtra {
  const extra: MockExtra = {
    signal: new AbortController().signal,
    requestId: "test-request-id",
    sendNotification: () => Promise.resolve(),
    sendRequest: () => Promise.resolve({} as never),
  };

  if (options?.quireToken !== undefined) {
    extra.authInfo = {
      token: "mcp-token",
      clientId: "test-client",
      scopes: ["read", "write"],
      extra: {
        quireToken: options.quireToken,
      },
    };
  }

  return extra;
}

/**
 * Create a mock QuireClient with customizable method implementations
 */
export function createMockClient(
  overrides?: Partial<QuireClient>
): QuireClient {
  const defaultClient: Partial<QuireClient> = {
    // User methods
    getMe: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "user-oid",
          id: "test-user",
          name: "Test User",
          nameText: "Test User",
          email: "test@example.com",
          url: "https://quire.io/u/test-user",
        },
      }),
    getUser: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "user-oid",
          id: "test-user",
          name: "Test User",
          nameText: "Test User",
          email: "test@example.com",
          url: "https://quire.io/u/test-user",
        },
      }),
    listUsers: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    listProjectMembers: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),

    // Organization methods
    listOrganizations: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    getOrganization: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "org-oid",
          id: "test-org",
          name: "Test Org",
          nameText: "Test Org",
          url: "https://quire.io/o/test-org",
        },
      }),
    updateOrganization: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "org-oid",
          id: "test-org",
          name: "Test Org",
          nameText: "Test Org",
          url: "https://quire.io/o/test-org",
        },
      }),

    // Project methods
    listProjects: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    getProject: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "project-oid",
          id: "test-project",
          name: "Test Project",
          nameText: "Test Project",
          url: "https://quire.io/w/test-project",
        },
      }),
    updateProject: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "project-oid",
          id: "test-project",
          name: "Test Project",
          nameText: "Test Project",
          url: "https://quire.io/w/test-project",
        },
      }),
    exportProject: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),

    // Task methods
    listTasks: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    getTask: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "task-oid",
          id: 1,
          name: "Test Task",
          nameText: "Test Task",
          url: "https://quire.io/w/test-project?t=1",
        },
      }),
    createTask: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "new-task-oid",
          id: 2,
          name: "New Task",
          nameText: "New Task",
          url: "https://quire.io/w/test-project?t=2",
        },
      }),
    updateTask: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "task-oid",
          id: 1,
          name: "Updated Task",
          nameText: "Updated Task",
          url: "https://quire.io/w/test-project?t=1",
        },
      }),
    deleteTask: () =>
      Promise.resolve({
        success: true,
        data: { oid: "task-oid" },
      }),
    searchTasks: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    createTaskAfter: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "after-task-oid",
          id: 3,
          name: "After Task",
          nameText: "After Task",
          url: "https://quire.io/w/test-project?t=3",
        },
      }),
    createTaskBefore: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "before-task-oid",
          id: 0,
          name: "Before Task",
          nameText: "Before Task",
          url: "https://quire.io/w/test-project?t=0",
        },
      }),
    searchFolderTasks: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    searchOrganizationTasks: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),

    // Tag methods
    listTags: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    getTag: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "tag-oid",
          id: 1,
          name: "Test Tag",
          nameText: "Test Tag",
        },
      }),
    createTag: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "new-tag-oid",
          id: 2,
          name: "New Tag",
          nameText: "New Tag",
        },
      }),
    updateTag: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "tag-oid",
          id: 1,
          name: "Updated Tag",
          nameText: "Updated Tag",
        },
      }),
    deleteTag: () =>
      Promise.resolve({
        success: true,
        data: { oid: "tag-oid" },
      }),

    // Comment methods
    listTaskComments: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    addTaskComment: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "comment-oid",
          description: "Test comment",
          descriptionText: "Test comment",
          createdAt: "2024-01-01T00:00:00Z",
          createdBy: {
            id: "test-user",
            name: "Test User",
            nameText: "Test User",
          },
        },
      }),
    updateComment: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "comment-oid",
          description: "Updated comment",
          descriptionText: "Updated comment",
          createdAt: "2024-01-01T00:00:00Z",
          createdBy: {
            id: "test-user",
            name: "Test User",
            nameText: "Test User",
          },
        },
      }),
    deleteComment: () =>
      Promise.resolve({
        success: true,
        data: { oid: "comment-oid" },
      }),
    listChatComments: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    addChatComment: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "chat-comment-oid",
          description: "Chat comment",
          descriptionText: "Chat comment",
          createdAt: "2024-01-01T00:00:00Z",
          createdBy: {
            id: "test-user",
            name: "Test User",
            nameText: "Test User",
          },
        },
      }),

    // Status methods
    listStatuses: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    getStatus: () =>
      Promise.resolve({
        success: true,
        data: {
          value: 100,
          name: "Active",
          nameText: "Active",
        },
      }),
    createStatus: () =>
      Promise.resolve({
        success: true,
        data: {
          value: 200,
          name: "New Status",
          nameText: "New Status",
        },
      }),
    updateStatus: () =>
      Promise.resolve({
        success: true,
        data: {
          value: 100,
          name: "Updated Status",
          nameText: "Updated Status",
        },
      }),
    deleteStatus: () =>
      Promise.resolve({
        success: true,
        data: { value: 100 },
      }),

    // Partner methods
    getPartner: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "partner-oid",
          id: "test-partner",
          name: "Test Partner",
          nameText: "Test Partner",
        },
      }),
    listPartners: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),

    // Document methods
    createDocument: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "doc-oid",
          id: "test-doc",
          name: "Test Doc",
          nameText: "Test Doc",
        },
      }),
    getDocument: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "doc-oid",
          id: "test-doc",
          name: "Test Doc",
          nameText: "Test Doc",
        },
      }),
    listDocuments: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    updateDocument: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "doc-oid",
          id: "test-doc",
          name: "Updated Doc",
          nameText: "Updated Doc",
        },
      }),
    deleteDocument: () =>
      Promise.resolve({
        success: true,
        data: { oid: "doc-oid" },
      }),

    // Sublist methods
    createSublist: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "sublist-oid",
          id: "test-sublist",
          name: "Test Sublist",
          nameText: "Test Sublist",
        },
      }),
    getSublist: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "sublist-oid",
          id: "test-sublist",
          name: "Test Sublist",
          nameText: "Test Sublist",
        },
      }),
    listSublists: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    updateSublist: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "sublist-oid",
          id: "test-sublist",
          name: "Updated Sublist",
          nameText: "Updated Sublist",
        },
      }),
    deleteSublist: () =>
      Promise.resolve({
        success: true,
        data: { oid: "sublist-oid" },
      }),

    // Chat methods
    createChat: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "chat-oid",
          id: "test-chat",
          name: "Test Chat",
          nameText: "Test Chat",
        },
      }),
    getChat: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "chat-oid",
          id: "test-chat",
          name: "Test Chat",
          nameText: "Test Chat",
        },
      }),
    listChats: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    updateChat: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "chat-oid",
          id: "test-chat",
          name: "Updated Chat",
          nameText: "Updated Chat",
        },
      }),
    deleteChat: () =>
      Promise.resolve({
        success: true,
        data: { oid: "chat-oid" },
      }),

    // Storage methods
    getStorageValue: () =>
      Promise.resolve({
        success: true,
        data: {
          name: "test-key",
          value: "test-value",
        },
      }),
    listStorageEntries: () =>
      Promise.resolve({
        success: true,
        data: [],
      }),
    putStorageValue: () =>
      Promise.resolve({
        success: true,
        data: {
          name: "test-key",
          value: "new-value",
        },
      }),
    deleteStorageValue: () =>
      Promise.resolve({
        success: true,
        data: { name: "test-key" },
      }),

    // Notification methods
    sendNotification: () =>
      Promise.resolve({
        success: true,
        data: { success: true },
      }),

    // Attachment methods
    uploadTaskAttachment: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "attachment-oid",
          name: "test-file.txt",
          url: "https://quire.io/attachments/test-file.txt",
          size: 1024,
          mimeType: "text/plain",
          createdAt: "2024-01-01T00:00:00Z",
          createdBy: {
            id: "test-user",
            name: "Test User",
            nameText: "Test User",
          },
        },
      }),
    uploadCommentAttachment: () =>
      Promise.resolve({
        success: true,
        data: {
          oid: "attachment-oid",
          name: "test-file.txt",
          url: "https://quire.io/attachments/test-file.txt",
          size: 1024,
          mimeType: "text/plain",
          createdAt: "2024-01-01T00:00:00Z",
          createdBy: {
            id: "test-user",
            name: "Test User",
            nameText: "Test User",
          },
        },
      }),
  };

  return { ...defaultClient, ...overrides } as QuireClient;
}

/**
 * Create common error results for testing
 */
export const mockErrors = {
  unauthorized: () => ({
    success: false as const,
    error: new QuireClientError("Invalid token", "UNAUTHORIZED", 401, false),
  }),

  forbidden: () => ({
    success: false as const,
    error: new QuireClientError("Permission denied", "FORBIDDEN", 403, false),
  }),

  notFound: () => ({
    success: false as const,
    error: new QuireClientError("Resource not found", "NOT_FOUND", 404, false),
  }),

  rateLimited: () => ({
    success: false as const,
    error: new QuireClientError(
      "Rate limit exceeded",
      "RATE_LIMITED",
      429,
      true
    ),
  }),

  serverError: () => ({
    success: false as const,
    error: new QuireClientError(
      "Internal server error",
      "SERVER_ERROR",
      500,
      true
    ),
  }),

  networkError: () => ({
    success: false as const,
    error: new QuireClientError(
      "Network connection failed",
      "NETWORK_ERROR",
      undefined,
      false
    ),
  }),

  timeout: () => ({
    success: false as const,
    error: new QuireClientError(
      "Request timed out",
      "TIMEOUT",
      undefined,
      true
    ),
  }),
};

/**
 * Extract text content from MCP tool response
 */
export function extractTextContent(
  response: { content: { type: string; text?: string }[] } | undefined
): string {
  if (!response) return "";
  const textContent = response.content.find((c) => c.type === "text");
  return textContent?.text ?? "";
}

/**
 * Check if response indicates an error
 */
export function isErrorResponse(
  response: { isError?: boolean } | undefined
): boolean {
  return response?.isError === true;
}
