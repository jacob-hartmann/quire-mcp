import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAttachmentTools } from "./attachment.js";
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

describe("Attachment Tools", () => {
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

    registerAttachmentTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all attachment tools", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(2);
    expect(registeredTools.has("quire.uploadTaskAttachment")).toBe(true);
    expect(registeredTools.has("quire.uploadCommentAttachment")).toBe(true);
  });

  describe("quire.uploadTaskAttachment", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.uploadTaskAttachment");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool not registered");

      const handlerFn = tool.handler.bind(tool);
      const result = (await handlerFn(
        { taskOid: "TaskOid", filename: "file.txt", content: "Hello" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should upload attachment with default mime type", async () => {
      const mockAttachment = {
        name: "file.txt",
        length: 5,
        url: "https://quire.io/attachments/file.txt",
        oid: "attachment-oid",
      };
      const mockClient = createMockClient({
        uploadTaskAttachment: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockAttachment,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.uploadTaskAttachment");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool not registered");

      const handlerFn = tool.handler.bind(tool);
      const result = (await handlerFn(
        { taskOid: "TaskOid", filename: "file.txt", content: "Hello" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("file.txt");
      expect(mockClient.uploadTaskAttachment).toHaveBeenCalledWith(
        "TaskOid",
        "file.txt",
        "Hello",
        undefined
      );
    });

    it("should upload attachment with custom mime type", async () => {
      const mockClient = createMockClient({
        uploadTaskAttachment: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { name: "data.json", length: 10, url: "https://quire.io/attachments/data.json", oid: "attachment-oid" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.uploadTaskAttachment");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool not registered");

      const handlerFn = tool.handler.bind(tool);
      await handlerFn(
        {
          taskOid: "TaskOid",
          filename: "data.json",
          content: '{"key":"value"}',
          mimeType: "application/json",
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.uploadTaskAttachment).toHaveBeenCalledWith(
        "TaskOid",
        "data.json",
        '{"key":"value"}',
        "application/json"
      );
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        uploadTaskAttachment: vi
          .fn()
          .mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.uploadTaskAttachment");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool not registered");

      const handlerFn = tool.handler.bind(tool);
      const result = (await handlerFn(
        { taskOid: "nonexistent", filename: "file.txt", content: "Hello" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });

    it("should handle FORBIDDEN error", async () => {
      const mockClient = createMockClient({
        uploadTaskAttachment: vi
          .fn()
          .mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.uploadTaskAttachment");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool not registered");

      const handlerFn = tool.handler.bind(tool);
      const result = (await handlerFn(
        { taskOid: "TaskOid", filename: "file.txt", content: "Hello" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("FORBIDDEN");
    });
  });

  describe("quire.uploadCommentAttachment", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.uploadCommentAttachment");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool not registered");

      const handlerFn = tool.handler.bind(tool);
      const result = (await handlerFn(
        { commentOid: "CommentOid", filename: "image.png", content: "data" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should upload attachment with default mime type", async () => {
      const mockAttachment = {
        name: "image.png",
        length: 20,
        url: "https://quire.io/attachments/image.png",
        oid: "attachment-oid",
      };
      const mockClient = createMockClient({
        uploadCommentAttachment: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockAttachment,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.uploadCommentAttachment");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool not registered");

      const handlerFn = tool.handler.bind(tool);
      const result = (await handlerFn(
        { commentOid: "CommentOid", filename: "image.png", content: "binary" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("image.png");
      expect(mockClient.uploadCommentAttachment).toHaveBeenCalledWith(
        "CommentOid",
        "image.png",
        "binary",
        undefined
      );
    });

    it("should upload attachment with custom mime type", async () => {
      const mockClient = createMockClient({
        uploadCommentAttachment: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { name: "image.png", length: 20, url: "https://quire.io/attachments/image.png", oid: "attachment-oid" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.uploadCommentAttachment");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool not registered");

      const handlerFn = tool.handler.bind(tool);
      await handlerFn(
        {
          commentOid: "CommentOid",
          filename: "image.png",
          content: "binary",
          mimeType: "image/png",
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.uploadCommentAttachment).toHaveBeenCalledWith(
        "CommentOid",
        "image.png",
        "binary",
        "image/png"
      );
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        uploadCommentAttachment: vi
          .fn()
          .mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.uploadCommentAttachment");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool not registered");

      const handlerFn = tool.handler.bind(tool);
      const result = (await handlerFn(
        { commentOid: "nonexistent", filename: "file.txt", content: "Hello" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });

    it("should handle RATE_LIMITED error", async () => {
      const mockClient = createMockClient({
        uploadCommentAttachment: vi
          .fn()
          .mockResolvedValueOnce(mockErrors.rateLimited()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.uploadCommentAttachment");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool not registered");

      const handlerFn = tool.handler.bind(tool);
      const result = (await handlerFn(
        { commentOid: "CommentOid", filename: "file.txt", content: "Hello" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("RATE_LIMITED");
    });
  });
});
