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
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(vi.fn());

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
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

    it("should handle write errors gracefully", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error("Write failed");
      });

      // Should not throw
      expect(() => {
        clearTokens();
      }).not.toThrow();
    });
  });

  describe("saveTokens error handling", () => {
    it("should throw when write fails", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error("Write failed");
      });

      expect(() => {
        saveTokens({ accessToken: "test" });
      }).toThrow("Write failed");
    });

    it("should throw when mkdir fails", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error("Mkdir failed");
      });

      expect(() => {
        saveTokens({ accessToken: "test" });
      }).toThrow("Mkdir failed");
    });
  });

  describe("getDefaultStoreDir platform handling", () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, "platform", {
        value: originalPlatform,
      });
    });

    it("should use APPDATA on Windows when available", () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      process.env["APPDATA"] = "C:\\Users\\Test\\AppData\\Roaming";
      delete process.env["QUIRE_TOKEN_STORE_PATH"];

      const path = getTokenStorePath();

      expect(path).toContain("quire-mcp");
      expect(path).toContain("tokens.json");
    });

    it("should fallback when APPDATA not set on Windows", () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      delete process.env["APPDATA"];
      delete process.env["QUIRE_TOKEN_STORE_PATH"];

      const path = getTokenStorePath();

      expect(path).toContain("quire-mcp");
      expect(path).toContain("tokens.json");
    });

    it("should use Library/Application Support on macOS", () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      delete process.env["QUIRE_TOKEN_STORE_PATH"];

      const path = getTokenStorePath();

      expect(path).toContain("quire-mcp");
      expect(path).toContain("tokens.json");
    });

    it("should use XDG_CONFIG_HOME on Linux when available", () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      process.env["XDG_CONFIG_HOME"] = "/home/test/.config";
      delete process.env["QUIRE_TOKEN_STORE_PATH"];

      const path = getTokenStorePath();

      expect(path).toContain("quire-mcp");
      expect(path).toContain("tokens.json");
    });

    it("should fallback to .config on Linux when XDG_CONFIG_HOME not set", () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      delete process.env["XDG_CONFIG_HOME"];
      delete process.env["QUIRE_TOKEN_STORE_PATH"];

      const path = getTokenStorePath();

      expect(path).toContain("quire-mcp");
      expect(path).toContain("tokens.json");
    });
  });
});
