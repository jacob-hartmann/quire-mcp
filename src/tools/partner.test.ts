import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPartnerTools } from "./partner.js";
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

describe("Partner Tools", () => {
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

    registerPartnerTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all partner tools", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(2);
    expect(registeredTools.has("quire.getPartner")).toBe(true);
    expect(registeredTools.has("quire.listPartners")).toBe(true);
  });

  describe("quire.getPartner", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.getPartner");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "PartnerOid" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should get partner by OID", async () => {
      const mockPartner = {
        oid: "PartnerOid",
        name: "External Team",
        nameText: "External Team",
      };
      const mockClient = createMockClient({
        getPartner: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockPartner,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getPartner");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "PartnerOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("External Team");
      expect(mockClient.getPartner).toHaveBeenCalledWith("PartnerOid");
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        getPartner: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getPartner");
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
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });
  });

  describe("quire.listPartners", () => {
    it("should list partners for project", async () => {
      const mockPartners = [
        { oid: "partner1", name: "Team A", nameText: "Team A" },
        { oid: "partner2", name: "Team B", nameText: "Team B" },
      ];
      const mockClient = createMockClient({
        listPartners: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockPartners,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listPartners");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("Team A");
      expect(extractTextContent(result)).toContain("Team B");
      expect(mockClient.listPartners).toHaveBeenCalledWith("my-project");
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        listPartners: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listPartners");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });

    it("should handle empty list", async () => {
      const mockClient = createMockClient({
        listPartners: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listPartners");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("[]");
    });

    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.listPartners");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });
  });

  describe("error handling for all error codes", () => {
    it("should handle UNAUTHORIZED error", async () => {
      const mockClient = createMockClient({
        getPartner: vi.fn().mockResolvedValueOnce(mockErrors.unauthorized()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getPartner");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "partner-oid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("UNAUTHORIZED");
      expect(extractTextContent(result)).toContain("invalid or expired");
    });

    it("should handle FORBIDDEN error", async () => {
      const mockClient = createMockClient({
        getPartner: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getPartner");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "partner-oid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("FORBIDDEN");
      expect(extractTextContent(result)).toContain("permission");
    });

    it("should handle RATE_LIMITED error", async () => {
      const mockClient = createMockClient({
        getPartner: vi.fn().mockResolvedValueOnce(mockErrors.rateLimited()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getPartner");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "partner-oid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("RATE_LIMITED");
      expect(extractTextContent(result)).toContain("rate limit");
    });

    it("should handle SERVER_ERROR with original message", async () => {
      const mockClient = createMockClient({
        getPartner: vi.fn().mockResolvedValueOnce(mockErrors.serverError()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getPartner");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "partner-oid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("SERVER_ERROR");
    });

    it("should handle listPartners UNAUTHORIZED error", async () => {
      const mockClient = createMockClient({
        listPartners: vi.fn().mockResolvedValueOnce(mockErrors.unauthorized()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listPartners");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("UNAUTHORIZED");
    });

    it("should handle listPartners FORBIDDEN error", async () => {
      const mockClient = createMockClient({
        listPartners: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listPartners");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("FORBIDDEN");
    });

    it("should handle listPartners RATE_LIMITED error", async () => {
      const mockClient = createMockClient({
        listPartners: vi.fn().mockResolvedValueOnce(mockErrors.rateLimited()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listPartners");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project" },
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
