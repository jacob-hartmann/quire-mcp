import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getHttpServerConfig } from "./config.js";

describe("getHttpServerConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("when OAuth credentials are missing", () => {
    it("should return undefined when QUIRE_OAUTH_CLIENT_ID is missing", () => {
      delete process.env["QUIRE_OAUTH_CLIENT_ID"];
      process.env["QUIRE_OAUTH_CLIENT_SECRET"] = "secret";

      const config = getHttpServerConfig();

      expect(config).toBeUndefined();
    });

    it("should return undefined when QUIRE_OAUTH_CLIENT_SECRET is missing", () => {
      process.env["QUIRE_OAUTH_CLIENT_ID"] = "client-id";
      delete process.env["QUIRE_OAUTH_CLIENT_SECRET"];

      const config = getHttpServerConfig();

      expect(config).toBeUndefined();
    });

    it("should return undefined when both credentials are missing", () => {
      delete process.env["QUIRE_OAUTH_CLIENT_ID"];
      delete process.env["QUIRE_OAUTH_CLIENT_SECRET"];

      const config = getHttpServerConfig();

      expect(config).toBeUndefined();
    });
  });

  describe("when OAuth credentials are provided", () => {
    beforeEach(() => {
      process.env["QUIRE_OAUTH_CLIENT_ID"] = "test-client-id";
      process.env["QUIRE_OAUTH_CLIENT_SECRET"] = "test-client-secret";
    });

    it("should return config with default values", () => {
      const config = getHttpServerConfig();

      expect(config).toBeDefined();
      expect(config?.host).toBe("127.0.0.1");
      expect(config?.port).toBe(3001);
      expect(config?.issuerUrl).toBe("http://localhost:3001");
      expect(config?.quireClientId).toBe("test-client-id");
      expect(config?.quireClientSecret).toBe("test-client-secret");
      expect(config?.quireRedirectUri).toBe(
        "http://localhost:3001/oauth/callback"
      );
    });

    it("should respect custom MCP_SERVER_HOST", () => {
      process.env["MCP_SERVER_HOST"] = "0.0.0.0";

      const config = getHttpServerConfig();

      expect(config?.host).toBe("0.0.0.0");
    });

    it("should respect custom MCP_SERVER_PORT", () => {
      process.env["MCP_SERVER_PORT"] = "8080";

      const config = getHttpServerConfig();

      expect(config?.port).toBe(8080);
      expect(config?.issuerUrl).toBe("http://localhost:8080");
      expect(config?.quireRedirectUri).toBe(
        "http://localhost:8080/oauth/callback"
      );
    });

    it("should respect custom MCP_ISSUER_URL", () => {
      process.env["MCP_ISSUER_URL"] = "http://localhost:9000";

      const config = getHttpServerConfig();

      expect(config?.issuerUrl).toBe("http://localhost:9000");
      expect(config?.quireRedirectUri).toBe(
        "http://localhost:9000/oauth/callback"
      );
    });

    it("should respect custom QUIRE_OAUTH_REDIRECT_URI", () => {
      process.env["QUIRE_OAUTH_REDIRECT_URI"] =
        "http://localhost:3000/custom/callback";

      const config = getHttpServerConfig();

      expect(config?.quireRedirectUri).toBe(
        "http://localhost:3000/custom/callback"
      );
    });
  });

  describe("localhost detection", () => {
    beforeEach(() => {
      process.env["QUIRE_OAUTH_CLIENT_ID"] = "test-client-id";
      process.env["QUIRE_OAUTH_CLIENT_SECRET"] = "test-client-secret";
    });

    it("should allow HTTP for localhost", () => {
      process.env["MCP_ISSUER_URL"] = "http://localhost:3000";

      const config = getHttpServerConfig();

      expect(config).toBeDefined();
    });

    it("should allow HTTP for 127.0.0.1", () => {
      process.env["MCP_ISSUER_URL"] = "http://127.0.0.1:3000";

      const config = getHttpServerConfig();

      expect(config).toBeDefined();
    });

    it("should allow HTTP for [::1] (IPv6 loopback)", () => {
      process.env["MCP_ISSUER_URL"] = "http://[::1]:3000";

      const config = getHttpServerConfig();

      expect(config).toBeDefined();
    });

    it("should allow HTTPS for external hosts", () => {
      process.env["MCP_ISSUER_URL"] = "https://example.com";

      const config = getHttpServerConfig();

      expect(config).toBeDefined();
      expect(config?.issuerUrl).toBe("https://example.com");
    });

    it("should return undefined for HTTP on external hosts", () => {
      process.env["MCP_ISSUER_URL"] = "http://example.com";

      const config = getHttpServerConfig();

      expect(config).toBeUndefined();
    });

    it("should return undefined for HTTP on IP addresses that are not localhost", () => {
      process.env["MCP_ISSUER_URL"] = "http://192.168.1.1:3000";

      const config = getHttpServerConfig();

      expect(config).toBeUndefined();
    });
  });

  describe("invalid URL handling", () => {
    beforeEach(() => {
      process.env["QUIRE_OAUTH_CLIENT_ID"] = "test-client-id";
      process.env["QUIRE_OAUTH_CLIENT_SECRET"] = "test-client-secret";
    });

    it("should return undefined for invalid issuer URL", () => {
      process.env["MCP_ISSUER_URL"] = "not-a-valid-url";

      const config = getHttpServerConfig();

      // Invalid URL will fail localhost check and be rejected as insecure HTTP
      expect(config).toBeUndefined();
    });
  });
});
