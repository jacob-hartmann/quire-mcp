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
    getMe: async () => ({
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
    getUser: async () => ({
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
    listUsers: async () => ({
      success: true,
      data: [],
    }),
    listProjectMembers: async () => ({
      success: true,
      data: [],
    }),

    // Organization methods
    listOrganizations: async () => ({
      success: true,
      data: [],
    }),
    getOrganization: async () => ({
      success: true,
      data: {
        oid: "org-oid",
        id: "test-org",
        name: "Test Org",
        nameText: "Test Org",
        url: "https://quire.io/o/test-org",
      },
    }),
    updateOrganization: async () => ({
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
    listProjects: async () => ({
      success: true,
      data: [],
    }),
    getProject: async () => ({
      success: true,
      data: {
        oid: "project-oid",
        id: "test-project",
        name: "Test Project",
        nameText: "Test Project",
        url: "https://quire.io/w/test-project",
      },
    }),
    updateProject: async () => ({
      success: true,
      data: {
        oid: "project-oid",
        id: "test-project",
        name: "Test Project",
        nameText: "Test Project",
        url: "https://quire.io/w/test-project",
      },
    }),
    exportProject: async () => ({
      success: true,
      data: [],
    }),

    // Task methods
    listTasks: async () => ({
      success: true,
      data: [],
    }),
    getTask: async () => ({
      success: true,
      data: {
        oid: "task-oid",
        id: 1,
        name: "Test Task",
        nameText: "Test Task",
        url: "https://quire.io/w/test-project?t=1",
      },
    }),
    createTask: async () => ({
      success: true,
      data: {
        oid: "new-task-oid",
        id: 2,
        name: "New Task",
        nameText: "New Task",
        url: "https://quire.io/w/test-project?t=2",
      },
    }),
    updateTask: async () => ({
      success: true,
      data: {
        oid: "task-oid",
        id: 1,
        name: "Updated Task",
        nameText: "Updated Task",
        url: "https://quire.io/w/test-project?t=1",
      },
    }),
    deleteTask: async () => ({
      success: true,
      data: { oid: "task-oid" },
    }),
    searchTasks: async () => ({
      success: true,
      data: [],
    }),
    createTaskAfter: async () => ({
      success: true,
      data: {
        oid: "after-task-oid",
        id: 3,
        name: "After Task",
        nameText: "After Task",
        url: "https://quire.io/w/test-project?t=3",
      },
    }),
    createTaskBefore: async () => ({
      success: true,
      data: {
        oid: "before-task-oid",
        id: 0,
        name: "Before Task",
        nameText: "Before Task",
        url: "https://quire.io/w/test-project?t=0",
      },
    }),
    searchFolderTasks: async () => ({
      success: true,
      data: [],
    }),
    searchOrganizationTasks: async () => ({
      success: true,
      data: [],
    }),

    // Tag methods
    listTags: async () => ({
      success: true,
      data: [],
    }),
    getTag: async () => ({
      success: true,
      data: {
        oid: "tag-oid",
        id: 1,
        name: "Test Tag",
      },
    }),
    createTag: async () => ({
      success: true,
      data: {
        oid: "new-tag-oid",
        id: 2,
        name: "New Tag",
      },
    }),
    updateTag: async () => ({
      success: true,
      data: {
        oid: "tag-oid",
        id: 1,
        name: "Updated Tag",
      },
    }),
    deleteTag: async () => ({
      success: true,
      data: { oid: "tag-oid" },
    }),

    // Comment methods
    listTaskComments: async () => ({
      success: true,
      data: [],
    }),
    addTaskComment: async () => ({
      success: true,
      data: {
        oid: "comment-oid",
        description: "Test comment",
      },
    }),
    updateComment: async () => ({
      success: true,
      data: {
        oid: "comment-oid",
        description: "Updated comment",
      },
    }),
    deleteComment: async () => ({
      success: true,
      data: { oid: "comment-oid" },
    }),
    listChatComments: async () => ({
      success: true,
      data: [],
    }),
    addChatComment: async () => ({
      success: true,
      data: {
        oid: "chat-comment-oid",
        description: "Chat comment",
      },
    }),

    // Status methods
    listStatuses: async () => ({
      success: true,
      data: [],
    }),
    getStatus: async () => ({
      success: true,
      data: {
        value: 100,
        name: "Active",
      },
    }),
    createStatus: async () => ({
      success: true,
      data: {
        value: 200,
        name: "New Status",
      },
    }),
    updateStatus: async () => ({
      success: true,
      data: {
        value: 100,
        name: "Updated Status",
      },
    }),
    deleteStatus: async () => ({
      success: true,
      data: { value: 100 },
    }),

    // Partner methods
    getPartner: async () => ({
      success: true,
      data: {
        oid: "partner-oid",
        name: "Test Partner",
        nameText: "Test Partner",
      },
    }),
    listPartners: async () => ({
      success: true,
      data: [],
    }),

    // Document methods
    createDocument: async () => ({
      success: true,
      data: {
        oid: "doc-oid",
        id: "test-doc",
        name: "Test Doc",
        nameText: "Test Doc",
      },
    }),
    getDocument: async () => ({
      success: true,
      data: {
        oid: "doc-oid",
        id: "test-doc",
        name: "Test Doc",
        nameText: "Test Doc",
      },
    }),
    listDocuments: async () => ({
      success: true,
      data: [],
    }),
    updateDocument: async () => ({
      success: true,
      data: {
        oid: "doc-oid",
        id: "test-doc",
        name: "Updated Doc",
        nameText: "Updated Doc",
      },
    }),
    deleteDocument: async () => ({
      success: true,
      data: { oid: "doc-oid" },
    }),

    // Sublist methods
    createSublist: async () => ({
      success: true,
      data: {
        oid: "sublist-oid",
        id: "test-sublist",
        name: "Test Sublist",
        nameText: "Test Sublist",
      },
    }),
    getSublist: async () => ({
      success: true,
      data: {
        oid: "sublist-oid",
        id: "test-sublist",
        name: "Test Sublist",
        nameText: "Test Sublist",
      },
    }),
    listSublists: async () => ({
      success: true,
      data: [],
    }),
    updateSublist: async () => ({
      success: true,
      data: {
        oid: "sublist-oid",
        id: "test-sublist",
        name: "Updated Sublist",
        nameText: "Updated Sublist",
      },
    }),
    deleteSublist: async () => ({
      success: true,
      data: { oid: "sublist-oid" },
    }),

    // Chat methods
    createChat: async () => ({
      success: true,
      data: {
        oid: "chat-oid",
        id: "test-chat",
        name: "Test Chat",
        nameText: "Test Chat",
      },
    }),
    getChat: async () => ({
      success: true,
      data: {
        oid: "chat-oid",
        id: "test-chat",
        name: "Test Chat",
        nameText: "Test Chat",
      },
    }),
    listChats: async () => ({
      success: true,
      data: [],
    }),
    updateChat: async () => ({
      success: true,
      data: {
        oid: "chat-oid",
        id: "test-chat",
        name: "Updated Chat",
        nameText: "Updated Chat",
      },
    }),
    deleteChat: async () => ({
      success: true,
      data: { oid: "chat-oid" },
    }),

    // Storage methods
    getStorageValue: async () => ({
      success: true,
      data: {
        name: "test-key",
        value: "test-value",
      },
    }),
    listStorageEntries: async () => ({
      success: true,
      data: [],
    }),
    putStorageValue: async () => ({
      success: true,
      data: {
        name: "test-key",
        value: "new-value",
      },
    }),
    deleteStorageValue: async () => ({
      success: true,
      data: { name: "test-key" },
    }),

    // Notification methods
    sendNotification: async () => ({
      success: true,
      data: { success: true },
    }),

    // Attachment methods
    uploadTaskAttachment: async () => ({
      success: true,
      data: {
        oid: "attachment-oid",
        name: "test-file.txt",
      },
    }),
    uploadCommentAttachment: async () => ({
      success: true,
      data: {
        oid: "attachment-oid",
        name: "test-file.txt",
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
    error: new QuireClientError(
      "Permission denied",
      "FORBIDDEN",
      403,
      false
    ),
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
  response: { content: Array<{ type: string; text?: string }> } | undefined
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
