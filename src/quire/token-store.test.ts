import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  getTokenStorePath,
  loadTokens,
  saveTokens,
  clearTokens,
} from "./token-store.js";

// Mock fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe("token-store", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getTokenStorePath", () => {
    it("should use QUIRE_TOKEN_STORE_PATH if set", () => {
      process.env["QUIRE_TOKEN_STORE_PATH"] = "/custom/path/tokens.json";

      const path = getTokenStorePath();

      expect(path).toBe("/custom/path/tokens.json");
    });

    it("should return platform-specific default when env var not set", () => {
      delete process.env["QUIRE_TOKEN_STORE_PATH"];

      const path = getTokenStorePath();

      // Should contain quire-mcp and tokens.json
      expect(path).toContain("quire-mcp");
      expect(path).toContain("tokens.json");
    });
  });

  describe("loadTokens", () => {
    it("should return undefined when file does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const tokens = loadTokens();

      expect(tokens).toBeUndefined();
    });

    it("should return tokens when file exists with valid data", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          accessToken: "test-token",
          refreshToken: "refresh-token",
          expiresAt: "2024-01-01T00:00:00.000Z",
        })
      );

      const tokens = loadTokens();

      expect(tokens).toEqual({
        accessToken: "test-token",
        refreshToken: "refresh-token",
        expiresAt: "2024-01-01T00:00:00.000Z",
      });
    });

    it("should return undefined for invalid JSON", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("not valid json");

      const tokens = loadTokens();

      expect(tokens).toBeUndefined();
    });

    it("should return undefined for JSON without accessToken", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ foo: "bar" }));

      const tokens = loadTokens();

      expect(tokens).toBeUndefined();
    });
  });

  describe("saveTokens", () => {
    it("should create directory if it does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      saveTokens({ accessToken: "test" });

      expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
      });
    });

    it("should write tokens to file with restricted permissions", () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const tokens = {
        accessToken: "access-123",
        refreshToken: "refresh-456",
      };

      saveTokens(tokens);

      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("tokens.json"),
        JSON.stringify(tokens, null, 2),
        expect.objectContaining({ mode: 0o600 })
      );
    });
  });

  describe("clearTokens", () => {
    it("should write empty object when file exists", () => {
      vi.mocked(existsSync).mockReturnValue(true);

      clearTokens();

      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("tokens.json"),
        "{}",
        expect.objectContaining({ mode: 0o600 })
      );
    });

    it("should do nothing when file does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      clearTokens();

      expect(writeFileSync).not.toHaveBeenCalled();
    });
  });
});
