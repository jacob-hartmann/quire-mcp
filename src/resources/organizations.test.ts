import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOrganizationsResource } from "./organizations.js";

vi.mock("../quire/client-factory.js", () => ({
  getQuireClientOrThrow: vi.fn(),
}));

import { getQuireClientOrThrow } from "../quire/client-factory.js";

describe("registerOrganizationsResource", () => {
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

    registerOrganizationsResource(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register organizations resource", () => {
    expect(server.registerResource).toHaveBeenCalledWith(
      "organizations",
      "quire://organizations",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        description: expect.any(String),
      }),
      expect.any(Function)
    );
    expect(registeredResources.has("organizations")).toBe(true);
    expect(registeredResources.get("organizations")?.uri).toBe(
      "quire://organizations"
    );
  });

  describe("resource handler", () => {
    it("should return organizations data on success", async () => {
      const mockOrgs = [
        {
          oid: "org-oid-1",
          id: "org1",
          name: "Test Organization 1",
        },
        {
          oid: "org-oid-2",
          id: "org2",
          name: "Test Organization 2",
        },
      ];

      const mockClient = {
        listOrganizations: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockOrgs,
        }),
      };

      vi.mocked(getQuireClientOrThrow).mockResolvedValueOnce(
        mockClient as unknown as Awaited<
          ReturnType<typeof getQuireClientOrThrow>
        >
      );

      const resource = registeredResources.get("organizations");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      const result = (await resource.handler("quire://organizations", {})) as {
        contents: {
          uri: string;
          mimeType: string;
          text: string;
        }[];
      };

      expect(result.contents).toHaveLength(1);
      const content = result.contents[0];
      expect(content).toBeDefined();
      expect(content?.uri).toBe("quire://organizations");
      expect(content?.mimeType).toBe("application/json");
      expect(content && JSON.parse(content.text)).toEqual(mockOrgs);
    });

    it("should throw error on client failure", async () => {
      const mockClient = {
        listOrganizations: vi.fn().mockResolvedValueOnce({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid token" },
        }),
      };

      vi.mocked(getQuireClientOrThrow).mockResolvedValueOnce(
        mockClient as unknown as Awaited<
          ReturnType<typeof getQuireClientOrThrow>
        >
      );

      const resource = registeredResources.get("organizations");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      await expect(
        resource.handler("quire://organizations", {})
      ).rejects.toThrow(
        "Failed to fetch organizations: UNAUTHORIZED - Invalid token"
      );
    });

    it("should propagate getQuireClientOrThrow errors", async () => {
      vi.mocked(getQuireClientOrThrow).mockRejectedValueOnce(
        new Error("Authentication required")
      );

      const resource = registeredResources.get("organizations");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      await expect(
        resource.handler("quire://organizations", {})
      ).rejects.toThrow("Authentication required");
    });
  });
});
