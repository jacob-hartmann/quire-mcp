import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOrganizationTools } from "./organization.js";
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

describe("Organization Tools", () => {
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

    registerOrganizationTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all organization tools", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(3);
    expect(registeredTools.has("quire.listOrganizations")).toBe(true);
    expect(registeredTools.has("quire.getOrganization")).toBe(true);
    expect(registeredTools.has("quire.updateOrganization")).toBe(true);
  });

  describe("quire.listOrganizations", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token available",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.listOrganizations")!;
      const result = (await tool.handler({}, createMockExtra())) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should list organizations on success", async () => {
      const mockOrgs = [
        { oid: "org1", id: "my-org", name: "My Organization" },
        { oid: "org2", id: "other-org", name: "Other Organization" },
      ];
      const mockClient = createMockClient({
        listOrganizations: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockOrgs,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listOrganizations")!;
      const result = (await tool.handler(
        {},
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      const text = extractTextContent(result);
      expect(text).toContain("my-org");
      expect(text).toContain("other-org");
    });

    it("should handle API errors", async () => {
      const mockClient = createMockClient({
        listOrganizations: vi
          .fn()
          .mockResolvedValueOnce(mockErrors.unauthorized()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listOrganizations")!;
      const result = (await tool.handler(
        {},
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("UNAUTHORIZED");
    });
  });

  describe("quire.getOrganization", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "Token expired",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.getOrganization")!;
      const result = (await tool.handler(
        { id: "my-org" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should get organization by ID", async () => {
      const mockOrg = {
        oid: "org-oid",
        id: "my-org",
        name: "My Organization",
        nameText: "My Organization",
        url: "https://quire.io/o/my-org",
      };
      const mockClient = createMockClient({
        getOrganization: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockOrg,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getOrganization")!;
      const result = (await tool.handler(
        { id: "my-org" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      const text = extractTextContent(result);
      expect(text).toContain("my-org");
      expect(text).toContain("My Organization");
      expect(mockClient.getOrganization).toHaveBeenCalledWith("my-org");
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        getOrganization: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getOrganization")!;
      const result = (await tool.handler(
        { id: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
      expect(extractTextContent(result)).toContain("organization was not found");
    });
  });

  describe("quire.updateOrganization", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "Invalid token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.updateOrganization")!;
      const result = (await tool.handler(
        { id: "my-org", addFollowers: ["user1"] },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should update organization followers", async () => {
      const mockOrg = {
        oid: "org-oid",
        id: "my-org",
        name: "My Organization",
        nameText: "My Organization",
      };
      const mockClient = createMockClient({
        updateOrganization: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockOrg,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateOrganization")!;
      const result = (await tool.handler(
        { id: "my-org", addFollowers: ["user1", "user2"] },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.updateOrganization).toHaveBeenCalledWith("my-org", {
        addFollowers: ["user1", "user2"],
      });
    });

    it("should handle removeFollowers parameter", async () => {
      const mockClient = createMockClient({
        updateOrganization: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "org-oid", id: "my-org", name: "Org" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateOrganization")!;
      await tool.handler(
        { id: "my-org", removeFollowers: ["user3"] },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateOrganization).toHaveBeenCalledWith("my-org", {
        removeFollowers: ["user3"],
      });
    });

    it("should handle followers replacement", async () => {
      const mockClient = createMockClient({
        updateOrganization: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "org-oid", id: "my-org", name: "Org" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateOrganization")!;
      await tool.handler(
        { id: "my-org", followers: ["user1", "user2"] },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateOrganization).toHaveBeenCalledWith("my-org", {
        followers: ["user1", "user2"],
      });
    });

    it("should handle FORBIDDEN error", async () => {
      const mockClient = createMockClient({
        updateOrganization: vi
          .fn()
          .mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateOrganization")!;
      const result = (await tool.handler(
        { id: "my-org", addFollowers: ["user1"] },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("FORBIDDEN");
    });

    it("should handle RATE_LIMITED error", async () => {
      const mockClient = createMockClient({
        updateOrganization: vi
          .fn()
          .mockResolvedValueOnce(mockErrors.rateLimited()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateOrganization")!;
      const result = (await tool.handler(
        { id: "my-org" },
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
