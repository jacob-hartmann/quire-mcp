import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCommentTools } from "./comment.js";
import {
  createMockExtra,
  createMockClient,
  mockErrors,
  extractTextContent,
  isErrorResponse,
} from "./__test-utils__.js";
import type { QuireClientResult } from "../quire/client-factory.js";

vi.mock("../quire/client-factory.js", () => ({
  getQuireClient: vi.fn(),
}));

import { getQuireClient } from "../quire/client-factory.js";

describe("Comment Tools", () => {
  let server: McpServer;
  let registeredTools: Map<
    string,
    {
      description: string;
      handler: (
        params: Record<string, unknown>,
        extra: unknown
      ) => Promise<unknown>;
    }
  >;

  beforeEach(() => {
    vi.clearAllMocks();

    registeredTools = new Map();
    server = {
      registerTool: vi.fn(
        (
          name: string,
          config: { description: string },
          handler: (
            params: Record<string, unknown>,
            extra: unknown
          ) => Promise<unknown>
        ) => {
          registeredTools.set(name, { description: config.description, handler });
        }
      ),
    } as unknown as McpServer;

    registerCommentTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all comment tools", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(6);
    expect(registeredTools.has("quire.listTaskComments")).toBe(true);
    expect(registeredTools.has("quire.addTaskComment")).toBe(true);
    expect(registeredTools.has("quire.updateComment")).toBe(true);
    expect(registeredTools.has("quire.deleteComment")).toBe(true);
    expect(registeredTools.has("quire.listChatComments")).toBe(true);
    expect(registeredTools.has("quire.addChatComment")).toBe(true);
  });

  describe("quire.listTaskComments", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.listTaskComments")!;
      const result = (await tool.handler(
        { taskOid: "TaskOid" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should list comments by task OID", async () => {
      const mockComments = [
        { oid: "comment1", description: "First comment" },
        { oid: "comment2", description: "Second comment" },
      ];
      const mockClient = createMockClient({
        listTaskComments: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockComments,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listTaskComments")!;
      const result = (await tool.handler(
        { taskOid: "TaskOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("First comment");
      expect(mockClient.listTaskComments).toHaveBeenCalledWith("TaskOid");
    });

    it("should list comments by project ID and task ID", async () => {
      const mockClient = createMockClient({
        listTaskComments: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listTaskComments")!;
      await tool.handler(
        { projectId: "my-project", taskId: 123 },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.listTaskComments).toHaveBeenCalledWith(
        "my-project",
        123
      );
    });

    it("should return error when neither taskOid nor projectId+taskId provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listTaskComments")!;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain(
        "Must provide either 'taskOid' or both 'projectId' and 'taskId'"
      );
    });
  });

  describe("quire.addTaskComment", () => {
    it("should add comment by task OID", async () => {
      const mockComment = { oid: "comment1", description: "New comment" };
      const mockClient = createMockClient({
        addTaskComment: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockComment,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.addTaskComment")!;
      const result = (await tool.handler(
        { taskOid: "TaskOid", description: "New comment" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.addTaskComment).toHaveBeenCalledWith("TaskOid", {
        description: "New comment",
      });
    });

    it("should add comment by project ID and task ID", async () => {
      const mockClient = createMockClient({
        addTaskComment: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "comment1", description: "Comment" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.addTaskComment")!;
      await tool.handler(
        { projectId: "my-project", taskId: 123, description: "Comment" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.addTaskComment).toHaveBeenCalledWith(
        "my-project",
        123,
        { description: "Comment" }
      );
    });

    it("should return error when neither taskOid nor projectId+taskId provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.addTaskComment")!;
      const result = (await tool.handler(
        { description: "Comment" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle API errors", async () => {
      const mockClient = createMockClient({
        addTaskComment: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.addTaskComment")!;
      const result = (await tool.handler(
        { taskOid: "TaskOid", description: "Comment" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("FORBIDDEN");
    });
  });

  describe("quire.updateComment", () => {
    it("should update comment", async () => {
      const mockComment = { oid: "CommentOid", description: "Updated" };
      const mockClient = createMockClient({
        updateComment: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockComment,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateComment")!;
      const result = (await tool.handler(
        { oid: "CommentOid", description: "Updated" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.updateComment).toHaveBeenCalledWith("CommentOid", {
        description: "Updated",
      });
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        updateComment: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateComment")!;
      const result = (await tool.handler(
        { oid: "nonexistent", description: "Updated" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });
  });

  describe("quire.deleteComment", () => {
    it("should delete comment", async () => {
      const mockClient = createMockClient({
        deleteComment: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "CommentOid" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteComment")!;
      const result = (await tool.handler(
        { oid: "CommentOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("deleted successfully");
      expect(mockClient.deleteComment).toHaveBeenCalledWith("CommentOid");
    });
  });

  describe("quire.listChatComments", () => {
    it("should list chat comments by chat OID", async () => {
      const mockComments = [{ oid: "comment1", description: "Chat message" }];
      const mockClient = createMockClient({
        listChatComments: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockComments,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listChatComments")!;
      const result = (await tool.handler(
        { chatOid: "ChatOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.listChatComments).toHaveBeenCalledWith("ChatOid");
    });

    it("should list chat comments by project ID and chat ID", async () => {
      const mockClient = createMockClient({
        listChatComments: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listChatComments")!;
      await tool.handler(
        { projectId: "my-project", chatId: "general" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.listChatComments).toHaveBeenCalledWith(
        "my-project",
        "general"
      );
    });

    it("should return error when neither chatOid nor projectId+chatId provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listChatComments")!;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });
  });

  describe("quire.addChatComment", () => {
    it("should add chat comment by chat OID", async () => {
      const mockComment = { oid: "comment1", description: "Chat message" };
      const mockClient = createMockClient({
        addChatComment: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockComment,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.addChatComment")!;
      const result = (await tool.handler(
        { chatOid: "ChatOid", description: "Chat message" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.addChatComment).toHaveBeenCalledWith("ChatOid", {
        description: "Chat message",
      });
    });

    it("should add chat comment by project ID and chat ID", async () => {
      const mockClient = createMockClient({
        addChatComment: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "comment1", description: "Message" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.addChatComment")!;
      await tool.handler(
        { projectId: "my-project", chatId: "general", description: "Message" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.addChatComment).toHaveBeenCalledWith(
        "my-project",
        "general",
        { description: "Message" }
      );
    });

    it("should return error when neither chatOid nor projectId+chatId provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.addChatComment")!;
      const result = (await tool.handler(
        { description: "Message" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });
  });

  describe("authentication failures for all tools", () => {
    it("should return auth error for addTaskComment", async () => {
      const mockResult: QuireClientResult = { success: false, error: "No token" };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.addTaskComment")!;
      const result = (await tool.handler(
        { taskOid: "TaskOid", description: "Comment" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should return auth error for updateComment", async () => {
      const mockResult: QuireClientResult = { success: false, error: "No token" };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.updateComment")!;
      const result = (await tool.handler(
        { oid: "CommentOid", description: "Updated" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should return auth error for deleteComment", async () => {
      const mockResult: QuireClientResult = { success: false, error: "No token" };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.deleteComment")!;
      const result = (await tool.handler(
        { oid: "CommentOid" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should return auth error for listChatComments", async () => {
      const mockResult: QuireClientResult = { success: false, error: "No token" };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.listChatComments")!;
      const result = (await tool.handler(
        { chatOid: "ChatOid" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should return auth error for addChatComment", async () => {
      const mockResult: QuireClientResult = { success: false, error: "No token" };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.addChatComment")!;
      const result = (await tool.handler(
        { chatOid: "ChatOid", description: "Message" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });
  });

  describe("API error handling", () => {
    it("should handle listTaskComments API error", async () => {
      const mockClient = createMockClient({
        listTaskComments: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listTaskComments")!;
      const result = (await tool.handler(
        { taskOid: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle deleteComment API error", async () => {
      const mockClient = createMockClient({
        deleteComment: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteComment")!;
      const result = (await tool.handler(
        { oid: "CommentOid" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle listChatComments API error", async () => {
      const mockClient = createMockClient({
        listChatComments: vi.fn().mockResolvedValueOnce(mockErrors.unauthorized()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listChatComments")!;
      const result = (await tool.handler(
        { chatOid: "ChatOid" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle addChatComment API error", async () => {
      const mockClient = createMockClient({
        addChatComment: vi.fn().mockResolvedValueOnce(mockErrors.rateLimited()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.addChatComment")!;
      const result = (await tool.handler(
        { chatOid: "ChatOid", description: "Message" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });
  });
});
