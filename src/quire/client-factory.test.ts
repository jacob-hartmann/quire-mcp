import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  ServerRequest,
  ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import { getQuireClient, getQuireClientOrThrow } from "./client-factory.js";
import { QuireClient } from "./client.js";

// Mock the client module
import type * as ClientModule from "./client.js";
vi.mock("./client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof ClientModule>();
  return {
    ...actual,
    createClientFromAuth: vi.fn(),
  };
});

import { createClientFromAuth } from "./client.js";

type MockExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

function createMockExtra(options?: {
  quireToken?: string;
}): MockExtra {
  const extra: MockExtra = {
    signal: new AbortController().signal,
  };

  if (options?.quireToken !== undefined) {
    extra.authInfo = {
      token: "mcp-token",
      clientId: "test-client",
      scopes: ["read", "write"],
      extra: {
        quireToken: options.quireToken,
      },
    };
  }

  return extra;
}

describe("getQuireClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("HTTP mode (quireToken in authInfo)", () => {
    it("should return client when quireToken is present", async () => {
      const extra = createMockExtra({ quireToken: "valid-token" });
      const result = await getQuireClient(extra);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.client).toBeInstanceOf(QuireClient);
      }
      // Should not call createClientFromAuth when quireToken is present
      expect(createClientFromAuth).not.toHaveBeenCalled();
    });

    it("should fall back when quireToken is empty string", async () => {
      const extra = createMockExtra({ quireToken: "" });

      vi.mocked(createClientFromAuth).mockResolvedValueOnce({
        success: true,
        data: new QuireClient({ token: "fallback-token" }),
      });

      const result = await getQuireClient(extra);

      expect(result.success).toBe(true);
      expect(createClientFromAuth).toHaveBeenCalled();
    });

    it("should fall back when authInfo is missing", async () => {
      const extra: MockExtra = {
        signal: new AbortController().signal,
      };

      vi.mocked(createClientFromAuth).mockResolvedValueOnce({
        success: true,
        data: new QuireClient({ token: "fallback-token" }),
      });

      const result = await getQuireClient(extra);

      expect(result.success).toBe(true);
      expect(createClientFromAuth).toHaveBeenCalled();
    });

    it("should fall back when extra is missing from authInfo", async () => {
      const extra: MockExtra = {
        signal: new AbortController().signal,
        authInfo: {
          token: "mcp-token",
          clientId: "test-client",
          scopes: [],
        },
      };

      vi.mocked(createClientFromAuth).mockResolvedValueOnce({
        success: true,
        data: new QuireClient({ token: "fallback-token" }),
      });

      const result = await getQuireClient(extra);

      expect(result.success).toBe(true);
      expect(createClientFromAuth).toHaveBeenCalled();
    });
  });

  describe("stdio mode (fallback to createClientFromAuth)", () => {
    it("should return client when createClientFromAuth succeeds", async () => {
      const extra: MockExtra = {
        signal: new AbortController().signal,
      };

      vi.mocked(createClientFromAuth).mockResolvedValueOnce({
        success: true,
        data: new QuireClient({ token: "auth-token" }),
      });

      const result = await getQuireClient(extra);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.client).toBeInstanceOf(QuireClient);
      }
    });

    it("should return error when createClientFromAuth fails", async () => {
      const extra: MockExtra = {
        signal: new AbortController().signal,
      };

      const mockError = {
        message: "No token available",
        code: "MISSING_TOKEN",
      };

      vi.mocked(createClientFromAuth).mockResolvedValueOnce({
        success: false,
        error: mockError as ReturnType<
          typeof createClientFromAuth
        > extends Promise<infer R>
          ? R extends { success: false; error: infer E }
            ? E
            : never
          : never,
      });

      const result = await getQuireClient(extra);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("No token available");
      }
    });
  });
});

describe("getQuireClientOrThrow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return client when getQuireClient succeeds", async () => {
    const extra = createMockExtra({ quireToken: "valid-token" });

    const client = await getQuireClientOrThrow(extra);

    expect(client).toBeInstanceOf(QuireClient);
  });

  it("should throw Error when getQuireClient fails", async () => {
    const extra: MockExtra = {
      signal: new AbortController().signal,
    };

    const mockError = {
      message: "Authentication failed",
      code: "MISSING_TOKEN",
    };

    vi.mocked(createClientFromAuth).mockResolvedValueOnce({
      success: false,
      error: mockError as ReturnType<
        typeof createClientFromAuth
      > extends Promise<infer R>
        ? R extends { success: false; error: infer E }
          ? E
          : never
        : never,
    });

    await expect(getQuireClientOrThrow(extra)).rejects.toThrow(
      "Authentication failed"
    );
  });
});
