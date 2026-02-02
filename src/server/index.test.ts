import { describe, it, expect } from "vitest";
import * as serverModule from "./index.js";

describe("Server Module Exports", () => {
  describe("config exports", () => {
    it("should export getHttpServerConfig", () => {
      expect(serverModule.getHttpServerConfig).toBeDefined();
      expect(typeof serverModule.getHttpServerConfig).toBe("function");
    });
  });

  describe("http-server exports", () => {
    it("should export startHttpServer", () => {
      expect(serverModule.startHttpServer).toBeDefined();
      expect(typeof serverModule.startHttpServer).toBe("function");
    });
  });

  describe("quire-oauth-provider exports", () => {
    it("should export QuireProxyOAuthProvider", () => {
      expect(serverModule.QuireProxyOAuthProvider).toBeDefined();
      expect(typeof serverModule.QuireProxyOAuthProvider).toBe("function");
    });
  });

  describe("server-token-store exports", () => {
    it("should export getServerTokenStore", () => {
      expect(serverModule.getServerTokenStore).toBeDefined();
      expect(typeof serverModule.getServerTokenStore).toBe("function");
    });
  });
});
