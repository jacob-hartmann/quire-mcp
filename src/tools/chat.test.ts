import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerChatTools } from "./chat.js";
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

describe("Chat Tools", () => {
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
          registeredTools.set(name, {
            description: config.description,
            handler,
          });
        }
      ),
    } as unknown as McpServer;

    registerChatTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all chat tools", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(5);
    expect(registeredTools.has("quire.createChat")).toBe(true);
    expect(registeredTools.has("quire.getChat")).toBe(true);
    expect(registeredTools.has("quire.listChats")).toBe(true);
    expect(registeredTools.has("quire.updateChat")).toBe(true);
    expect(registeredTools.has("quire.deleteChat")).toBe(true);
  });

  describe("quire.createChat", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.createChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project", name: "General" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should create chat channel for project", async () => {
      const mockChat = { oid: "chat-oid", id: "general", name: "General" };
      const mockClient = createMockClient({
        createChat: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockChat,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project", name: "General" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.createChat).toHaveBeenCalledWith(
        "project",
        "my-project",
        { name: "General" }
      );
    });

    it("should create chat with description", async () => {
      const mockClient = createMockClient({
        createChat: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "chat-oid", id: "dev", name: "Dev" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        {
          ownerType: "organization",
          ownerId: "my-org",
          name: "Dev",
          description: "Developer chat",
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.createChat).toHaveBeenCalledWith(
        "organization",
        "my-org",
        { name: "Dev", description: "Developer chat" }
      );
    });
  });

  describe("quire.getChat", () => {
    it("should get chat by OID", async () => {
      const mockChat = { oid: "ChatOid", id: "general", name: "General" };
      const mockClient = createMockClient({
        getChat: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockChat,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "ChatOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.getChat).toHaveBeenCalledWith("ChatOid");
    });

    it("should get chat by full path", async () => {
      const mockClient = createMockClient({
        getChat: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "chat-oid", id: "general", name: "General" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { ownerType: "project", ownerId: "my-project", chatId: "general" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.getChat).toHaveBeenCalledWith(
        "project",
        "my-project",
        "general"
      );
    });

    it("should return error when neither OID nor full path provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });
  });

  describe("quire.listChats", () => {
    it("should list chats for project", async () => {
      const mockChats = [
        { oid: "chat1", id: "general", name: "General" },
        { oid: "chat2", id: "dev", name: "Dev" },
      ];
      const mockClient = createMockClient({
        listChats: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockChats,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listChats");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("General");
      expect(mockClient.listChats).toHaveBeenCalledWith(
        "project",
        "my-project"
      );
    });

    it("should list chats for organization", async () => {
      const mockClient = createMockClient({
        listChats: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listChats");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { ownerType: "organization", ownerId: "my-org" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.listChats).toHaveBeenCalledWith(
        "organization",
        "my-org"
      );
    });
  });

  describe("quire.updateChat", () => {
    it("should update chat by OID", async () => {
      const mockClient = createMockClient({
        updateChat: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "ChatOid", id: "general", name: "Updated" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { oid: "ChatOid", name: "Updated" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateChat).toHaveBeenCalledWith("ChatOid", {
        name: "Updated",
      });
    });

    it("should update chat by full path", async () => {
      const mockClient = createMockClient({
        updateChat: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "chat-oid", id: "general", name: "Updated" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        {
          ownerType: "project",
          ownerId: "my-project",
          chatId: "general",
          name: "Updated",
          description: "New description",
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateChat).toHaveBeenCalledWith(
        "project",
        "my-project",
        "general",
        { name: "Updated", description: "New description" }
      );
    });

    it("should return error when neither OID nor full path provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { name: "Updated" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });
  });

  describe("quire.deleteChat", () => {
    it("should delete chat by OID", async () => {
      const mockClient = createMockClient({
        deleteChat: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "ChatOid" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "ChatOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("deleted successfully");
      expect(mockClient.deleteChat).toHaveBeenCalledWith("ChatOid");
    });

    it("should delete chat by full path", async () => {
      const mockClient = createMockClient({
        deleteChat: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "chat-oid" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { ownerType: "project", ownerId: "my-project", chatId: "general" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.deleteChat).toHaveBeenCalledWith(
        "project",
        "my-project",
        "general"
      );
    });

    it("should return error when neither OID nor full path provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        {},
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.deleteChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "chat-oid" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should handle API error when deleting chat", async () => {
      const mockClient = createMockClient({
        deleteChat: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });
  });

  describe("API error handling", () => {
    it("should handle createChat API error", async () => {
      const mockClient = createMockClient({
        createChat: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project", name: "Test" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle getChat API error", async () => {
      const mockClient = createMockClient({
        getChat: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle listChats API error", async () => {
      const mockClient = createMockClient({
        listChats: vi.fn().mockResolvedValueOnce(mockErrors.unauthorized()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listChats");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle listChats authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.listChats");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should handle updateChat API error", async () => {
      const mockClient = createMockClient({
        updateChat: vi.fn().mockResolvedValueOnce(mockErrors.rateLimited()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "chat-oid", name: "Updated" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle updateChat authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.updateChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "chat-oid", name: "Updated" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });
  });

  describe("createChat", () => {
    it("should create chat", async () => {
      const mockClient = createMockClient({
        createChat: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "chat-oid", id: "dev", name: "Dev" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        {
          ownerType: "organization",
          ownerId: "my-org",
          name: "Dev",
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.createChat).toHaveBeenCalledWith(
        "organization",
        "my-org",
        { name: "Dev" }
      );
    });
  });

  describe("updateChat with property modifications", () => {
    it("should update chat with name", async () => {
      const mockClient = createMockClient({
        updateChat: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "chat-oid", id: "general", name: "General" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { oid: "chat-oid", name: "Updated Chat" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateChat).toHaveBeenCalledWith("chat-oid", {
        name: "Updated Chat",
      });
    });

    it("should update chat with description", async () => {
      const mockClient = createMockClient({
        updateChat: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "chat-oid", id: "general", name: "General" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { oid: "chat-oid", description: "Updated description" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateChat).toHaveBeenCalledWith("chat-oid", {
        description: "Updated description",
      });
    });

    it("should update chat with multiple properties", async () => {
      const mockClient = createMockClient({
        updateChat: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "chat-oid", id: "general", name: "General" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateChat");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        {
          oid: "chat-oid",
          name: "Updated Chat",
          description: "New description",
          archived: true,
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateChat).toHaveBeenCalledWith("chat-oid", {
        name: "Updated Chat",
        description: "New description",
        archived: true,
      });
    });
  });
});
