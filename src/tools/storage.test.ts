import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerStorageTools } from "./storage.js";
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

describe("Storage Tools", () => {
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

    registerStorageTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all storage tools", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(4);
    expect(registeredTools.has("quire.getStorageValue")).toBe(true);
    expect(registeredTools.has("quire.listStorageEntries")).toBe(true);
    expect(registeredTools.has("quire.putStorageValue")).toBe(true);
    expect(registeredTools.has("quire.deleteStorageValue")).toBe(true);
  });

  describe("quire.getStorageValue", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.getStorageValue")!;
      const result = (await tool.handler(
        { name: "my-key" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should get storage value by name", async () => {
      const mockEntry = { name: "my-key", value: "my-value" };
      const mockClient = createMockClient({
        getStorageValue: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockEntry,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getStorageValue")!;
      const result = (await tool.handler(
        { name: "my-key" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("my-key");
      expect(extractTextContent(result)).toContain("my-value");
      expect(mockClient.getStorageValue).toHaveBeenCalledWith("my-key");
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        getStorageValue: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getStorageValue")!;
      const result = (await tool.handler(
        { name: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });
  });

  describe("quire.listStorageEntries", () => {
    it("should list storage entries by prefix", async () => {
      const mockEntries = [
        { name: "app:setting1", value: "value1" },
        { name: "app:setting2", value: "value2" },
      ];
      const mockClient = createMockClient({
        listStorageEntries: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockEntries,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listStorageEntries")!;
      const result = (await tool.handler(
        { prefix: "app:" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("app:setting1");
      expect(extractTextContent(result)).toContain("app:setting2");
      expect(mockClient.listStorageEntries).toHaveBeenCalledWith("app:");
    });

    it("should handle empty results", async () => {
      const mockClient = createMockClient({
        listStorageEntries: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listStorageEntries")!;
      const result = (await tool.handler(
        { prefix: "nonexistent:" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("[]");
    });
  });

  describe("quire.putStorageValue", () => {
    it("should store a string value", async () => {
      const mockEntry = { name: "my-key", value: "new-value" };
      const mockClient = createMockClient({
        putStorageValue: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockEntry,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.putStorageValue")!;
      const result = (await tool.handler(
        { name: "my-key", value: "new-value" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.putStorageValue).toHaveBeenCalledWith(
        "my-key",
        "new-value"
      );
    });

    it("should store an object value", async () => {
      const mockClient = createMockClient({
        putStorageValue: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { name: "my-key", value: { foo: "bar", count: 42 } },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.putStorageValue")!;
      await tool.handler(
        { name: "my-key", value: { foo: "bar", count: 42 } },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.putStorageValue).toHaveBeenCalledWith("my-key", {
        foo: "bar",
        count: 42,
      });
    });

    it("should store a number value", async () => {
      const mockClient = createMockClient({
        putStorageValue: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { name: "counter", value: 100 },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.putStorageValue")!;
      await tool.handler(
        { name: "counter", value: 100 },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.putStorageValue).toHaveBeenCalledWith("counter", 100);
    });

    it("should handle API errors", async () => {
      const mockClient = createMockClient({
        putStorageValue: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.putStorageValue")!;
      const result = (await tool.handler(
        { name: "my-key", value: "value" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("FORBIDDEN");
    });
  });

  describe("quire.deleteStorageValue", () => {
    it("should delete storage value", async () => {
      const mockClient = createMockClient({
        deleteStorageValue: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { name: "my-key" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteStorageValue")!;
      const result = (await tool.handler(
        { name: "my-key" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("deleted successfully");
      expect(mockClient.deleteStorageValue).toHaveBeenCalledWith("my-key");
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        deleteStorageValue: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteStorageValue")!;
      const result = (await tool.handler(
        { name: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });
  });
});
