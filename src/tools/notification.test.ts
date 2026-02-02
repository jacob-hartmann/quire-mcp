import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerNotificationTools } from "./notification.js";
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

describe("Notification Tools", () => {
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

    registerNotificationTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register notification tool", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(1);
    expect(registeredTools.has("quire.sendNotification")).toBe(true);
  });

  describe("quire.sendNotification", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.sendNotification")!;
      const result = (await tool.handler(
        { message: "Hello!", userIds: ["user1"] },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should send notification with required params", async () => {
      const mockClient = createMockClient({
        sendNotification: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { success: true },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.sendNotification")!;
      const result = (await tool.handler(
        { message: "Hello!", userIds: ["user1", "user2"] },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("success");
      expect(mockClient.sendNotification).toHaveBeenCalledWith({
        message: "Hello!",
        userIds: ["user1", "user2"],
      });
    });

    it("should send notification with optional URL", async () => {
      const mockClient = createMockClient({
        sendNotification: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { success: true },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.sendNotification")!;
      await tool.handler(
        {
          message: "Check this out!",
          userIds: ["user1"],
          url: "https://quire.io/w/my-project",
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.sendNotification).toHaveBeenCalledWith({
        message: "Check this out!",
        userIds: ["user1"],
        url: "https://quire.io/w/my-project",
      });
    });

    it("should handle FORBIDDEN error", async () => {
      const mockClient = createMockClient({
        sendNotification: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.sendNotification")!;
      const result = (await tool.handler(
        { message: "Hello!", userIds: ["user1"] },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("FORBIDDEN");
    });

    it("should handle RATE_LIMITED error", async () => {
      const mockClient = createMockClient({
        sendNotification: vi
          .fn()
          .mockResolvedValueOnce(mockErrors.rateLimited()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.sendNotification")!;
      const result = (await tool.handler(
        { message: "Hello!", userIds: ["user1"] },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("RATE_LIMITED");
    });
  });
});
