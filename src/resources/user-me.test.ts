import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerUserMeResource } from "./user-me.js";

vi.mock("../quire/client-factory.js", () => ({
  getQuireClientOrThrow: vi.fn(),
}));

import { getQuireClientOrThrow } from "../quire/client-factory.js";

describe("registerUserMeResource", () => {
  let server: McpServer;
  let registeredResources: Map<
    string,
    {
      uri: string;
      description: string;
      handler: (uri: string, extra: unknown) => Promise<unknown>;
    }
  >;

  beforeEach(() => {
    vi.clearAllMocks();

    registeredResources = new Map();
    server = {
      registerResource: vi.fn(
        (
          name: string,
          uri: string,
          config: { description: string },
          handler: (uri: string, extra: unknown) => Promise<unknown>
        ) => {
          registeredResources.set(name, {
            uri,
            description: config.description,
            handler,
          });
        }
      ),
    } as unknown as McpServer;

    registerUserMeResource(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register user-me resource", () => {
    expect(server.registerResource).toHaveBeenCalledWith(
      "user-me",
      "quire://user/me",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        description: expect.any(String),
      }),
      expect.any(Function)
    );
    expect(registeredResources.has("user-me")).toBe(true);
    expect(registeredResources.get("user-me")?.uri).toBe("quire://user/me");
  });

  describe("resource handler", () => {
    it("should return user profile data on success", async () => {
      const mockUser = {
        oid: "user-oid",
        id: "user123",
        name: "Test User",
        email: "test@example.com",
      };

      const mockClient = {
        getMe: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockUser,
        }),
      };

      vi.mocked(getQuireClientOrThrow).mockResolvedValueOnce(
        mockClient as unknown as Awaited<
          ReturnType<typeof getQuireClientOrThrow>
        >
      );

      const resource = registeredResources.get("user-me");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      const result = (await resource.handler("quire://user/me", {})) as {
        contents: {
          uri: string;
          mimeType: string;
          text: string;
        }[];
      };

      expect(result.contents).toHaveLength(1);
      const content = result.contents[0];
      expect(content).toBeDefined();
      expect(content?.uri).toBe("quire://user/me");
      expect(content?.mimeType).toBe("application/json");
      expect(content && JSON.parse(content.text)).toEqual(mockUser);
    });

    it("should throw error on client failure", async () => {
      const mockClient = {
        getMe: vi.fn().mockResolvedValueOnce({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid token" },
        }),
      };

      vi.mocked(getQuireClientOrThrow).mockResolvedValueOnce(
        mockClient as unknown as Awaited<
          ReturnType<typeof getQuireClientOrThrow>
        >
      );

      const resource = registeredResources.get("user-me");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      await expect(resource.handler("quire://user/me", {})).rejects.toThrow(
        "Failed to fetch user: UNAUTHORIZED - Invalid token"
      );
    });

    it("should propagate getQuireClientOrThrow errors", async () => {
      vi.mocked(getQuireClientOrThrow).mockRejectedValueOnce(
        new Error("Authentication required")
      );

      const resource = registeredResources.get("user-me");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      await expect(resource.handler("quire://user/me", {})).rejects.toThrow(
        "Authentication required"
      );
    });
  });
});
