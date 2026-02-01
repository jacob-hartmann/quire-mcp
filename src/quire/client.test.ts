import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QuireClient, createClientFromEnv } from "./client.js";
import { QuireClientError } from "./types.js";

describe("QuireClient", () => {
  describe("constructor", () => {
    it("should create a client with required options", () => {
      const client = new QuireClient({ token: "test-token" });
      expect(client).toBeInstanceOf(QuireClient);
    });
  });

  describe("getMe", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should return user data on successful response", async () => {
      const mockUser = {
        id: "123",
        oid: "abc",
        name: "Test User",
        nameText: "Test User",
        email: "test@example.com",
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockUser), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const client = new QuireClient({ token: "test-token" });
      const result = await client.getMe();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockUser);
      }
    });

    it("should return UNAUTHORIZED error on 401", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Invalid token" }), {
          status: 401,
        })
      );

      const client = new QuireClient({ token: "bad-token" });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHORIZED");
        expect(result.error.statusCode).toBe(401);
      }
    });

    it("should return RATE_LIMITED error on 429", async () => {
      // Mock all retries to return 429
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ message: "Rate limited" }), {
          status: 429,
        })
      );

      const client = new QuireClient({
        token: "test-token",
        maxRetries: 0, // Disable retries for faster test
      });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("RATE_LIMITED");
        expect(result.error.retryable).toBe(true);
      }
    });

    it("should handle network errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const client = new QuireClient({ token: "test-token" });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NETWORK_ERROR");
      }
    });
  });
});

describe("createClientFromEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return error when QUIRE_ACCESS_TOKEN is not set", () => {
    delete process.env["QUIRE_ACCESS_TOKEN"];

    const result = createClientFromEnv();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(QuireClientError);
      expect(result.error.code).toBe("MISSING_TOKEN");
    }
  });

  it("should create client when QUIRE_ACCESS_TOKEN is set", () => {
    process.env["QUIRE_ACCESS_TOKEN"] = "test-token";

    const result = createClientFromEnv();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeInstanceOf(QuireClient);
    }
  });
});
