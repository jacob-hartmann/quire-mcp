import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWhoamiTool } from "./whoami.js";
import {
  createMockExtra,
  createMockClient,
  mockErrors,
  extractTextContent,
  isErrorResponse,
} from "./__test-utils__.js";
import type { QuireClientResult } from "../quire/client-factory.js";

// Mock the client-factory module
vi.mock("../quire/client-factory.js", () => ({
  getQuireClient: vi.fn(),
}));

import { getQuireClient } from "../quire/client-factory.js";

describe("quire.whoami tool", () => {
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

    // Create a mock server that captures registered tools
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

    // Register the tool
    registerWhoamiTool(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register the quire.whoami tool", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(1);
    expect(registeredTools.has("quire.whoami")).toBe(true);
  });

  describe("authentication failure", () => {
    it("should return error when getQuireClient fails", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token available",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.whoami");
      expect(tool).toBeDefined();
      if (!tool) return;
      const extra = createMockExtra();
      const result = (await tool.handler({}, extra)) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
      expect(extractTextContent(result)).toContain("No token available");
    });
  });

  describe("success response", () => {
    it("should return user profile on success", async () => {
      const mockClient = createMockClient({
        getMe: vi.fn().mockResolvedValueOnce({
          success: true,
          data: {
            oid: "user-oid-123",
            id: "john_doe",
            name: "John Doe",
            nameText: "John Doe",
            email: "john@example.com",
            url: "https://quire.io/u/john_doe",
          },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.whoami");
      expect(tool).toBeDefined();
      if (!tool) return;
      const extra = createMockExtra({ quireToken: "valid-token" });
      const result = (await tool.handler({}, extra)) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      const text = extractTextContent(result);
      expect(text).toContain("john_doe");
      expect(text).toContain("John Doe");
      expect(text).toContain("john@example.com");
    });
  });

  describe("API error responses", () => {
    it("should handle UNAUTHORIZED error", async () => {
      const mockClient = createMockClient({
        getMe: vi.fn().mockResolvedValueOnce(mockErrors.unauthorized()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.whoami");
      expect(tool).toBeDefined();
      if (!tool) return;
      const extra = createMockExtra({ quireToken: "invalid-token" });
      const result = (await tool.handler({}, extra)) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      const text = extractTextContent(result);
      expect(text).toContain("UNAUTHORIZED");
      expect(text).toContain("invalid or expired");
    });

    it("should handle FORBIDDEN error", async () => {
      const mockClient = createMockClient({
        getMe: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.whoami");
      expect(tool).toBeDefined();
      if (!tool) return;
      const extra = createMockExtra({ quireToken: "valid-token" });
      const result = (await tool.handler({}, extra)) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      const text = extractTextContent(result);
      expect(text).toContain("FORBIDDEN");
      expect(text).toContain("permission");
    });

    it("should handle RATE_LIMITED error", async () => {
      const mockClient = createMockClient({
        getMe: vi.fn().mockResolvedValueOnce(mockErrors.rateLimited()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.whoami");
      expect(tool).toBeDefined();
      if (!tool) return;
      const extra = createMockExtra({ quireToken: "valid-token" });
      const result = (await tool.handler({}, extra)) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      const text = extractTextContent(result);
      expect(text).toContain("RATE_LIMITED");
      expect(text).toContain("rate limit");
    });
  });
});
