import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
    expect(server.registerResource).toHaveBeenCalledTimes(1);
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
        mockClient as unknown as ReturnType<typeof getQuireClientOrThrow>
      );

      const resource = registeredResources.get("user-me")!;
      const result = (await resource.handler("quire://user/me", {})) as {
        contents: Array<{
          uri: string;
          mimeType: string;
          text: string;
        }>;
      };

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("quire://user/me");
      expect(result.contents[0].mimeType).toBe("application/json");
      expect(JSON.parse(result.contents[0].text)).toEqual(mockUser);
    });

    it("should throw error on client failure", async () => {
      const mockClient = {
        getMe: vi.fn().mockResolvedValueOnce({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid token" },
        }),
      };

      vi.mocked(getQuireClientOrThrow).mockResolvedValueOnce(
        mockClient as unknown as ReturnType<typeof getQuireClientOrThrow>
      );

      const resource = registeredResources.get("user-me")!;

      await expect(resource.handler("quire://user/me", {})).rejects.toThrow(
        "Failed to fetch user: UNAUTHORIZED - Invalid token"
      );
    });

    it("should propagate getQuireClientOrThrow errors", async () => {
      vi.mocked(getQuireClientOrThrow).mockRejectedValueOnce(
        new Error("Authentication required")
      );

      const resource = registeredResources.get("user-me")!;

      await expect(resource.handler("quire://user/me", {})).rejects.toThrow(
        "Authentication required"
      );
    });
  });
});
