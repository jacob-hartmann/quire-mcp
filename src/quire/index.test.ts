import { describe, it, expect } from "vitest";
import * as quireModule from "./index.js";

describe("Quire Module Exports", () => {
  describe("client exports", () => {
    it("should export QuireClient", () => {
      expect(quireModule.QuireClient).toBeDefined();
      expect(typeof quireModule.QuireClient).toBe("function");
    });

    it("should export createClientFromEnv", () => {
      expect(quireModule.createClientFromEnv).toBeDefined();
      expect(typeof quireModule.createClientFromEnv).toBe("function");
    });

    it("should export createClientFromAuth", () => {
      expect(quireModule.createClientFromAuth).toBeDefined();
      expect(typeof quireModule.createClientFromAuth).toBe("function");
    });
  });

  describe("client-factory exports", () => {
    it("should export getQuireClient", () => {
      expect(quireModule.getQuireClient).toBeDefined();
      expect(typeof quireModule.getQuireClient).toBe("function");
    });

    it("should export getQuireClientOrThrow", () => {
      expect(quireModule.getQuireClientOrThrow).toBeDefined();
      expect(typeof quireModule.getQuireClientOrThrow).toBe("function");
    });
  });

  describe("types exports", () => {
    it("should export QuireClientError", () => {
      expect(quireModule.QuireClientError).toBeDefined();
      expect(typeof quireModule.QuireClientError).toBe("function");
    });
  });

  describe("auth exports", () => {
    it("should export getQuireAccessToken", () => {
      expect(quireModule.getQuireAccessToken).toBeDefined();
      expect(typeof quireModule.getQuireAccessToken).toBe("function");
    });

    it("should export QuireAuthError", () => {
      expect(quireModule.QuireAuthError).toBeDefined();
      expect(typeof quireModule.QuireAuthError).toBe("function");
    });
  });

  describe("oauth exports", () => {
    it("should export buildAuthorizeUrl", () => {
      expect(quireModule.buildAuthorizeUrl).toBeDefined();
      expect(typeof quireModule.buildAuthorizeUrl).toBe("function");
    });

    it("should export exchangeCodeForToken", () => {
      expect(quireModule.exchangeCodeForToken).toBeDefined();
      expect(typeof quireModule.exchangeCodeForToken).toBe("function");
    });

    it("should export refreshAccessToken", () => {
      expect(quireModule.refreshAccessToken).toBeDefined();
      expect(typeof quireModule.refreshAccessToken).toBe("function");
    });

    it("should export isTokenExpired", () => {
      expect(quireModule.isTokenExpired).toBeDefined();
      expect(typeof quireModule.isTokenExpired).toBe("function");
    });

    it("should export loadOAuthConfigFromEnv", () => {
      expect(quireModule.loadOAuthConfigFromEnv).toBeDefined();
      expect(typeof quireModule.loadOAuthConfigFromEnv).toBe("function");
    });

    it("should export generateState", () => {
      expect(quireModule.generateState).toBeDefined();
      expect(typeof quireModule.generateState).toBe("function");
    });

    it("should export QuireOAuthError", () => {
      expect(quireModule.QuireOAuthError).toBeDefined();
      expect(typeof quireModule.QuireOAuthError).toBe("function");
    });
  });

  describe("token-store exports", () => {
    it("should export loadTokens", () => {
      expect(quireModule.loadTokens).toBeDefined();
      expect(typeof quireModule.loadTokens).toBe("function");
    });

    it("should export saveTokens", () => {
      expect(quireModule.saveTokens).toBeDefined();
      expect(typeof quireModule.saveTokens).toBe("function");
    });

    it("should export clearTokens", () => {
      expect(quireModule.clearTokens).toBeDefined();
      expect(typeof quireModule.clearTokens).toBe("function");
    });

    it("should export getTokenStorePath", () => {
      expect(quireModule.getTokenStorePath).toBeDefined();
      expect(typeof quireModule.getTokenStorePath).toBe("function");
    });
  });
});
