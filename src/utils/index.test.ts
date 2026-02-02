import { describe, it, expect } from "vitest";
import * as utilsModule from "./index.js";

describe("Utils Module Exports", () => {
  describe("html exports", () => {
    it("should export escapeHtml", () => {
      expect(utilsModule.escapeHtml).toBeDefined();
      expect(typeof utilsModule.escapeHtml).toBe("function");
    });

    it("escapeHtml should work correctly", () => {
      expect(utilsModule.escapeHtml("<script>")).toBe("&lt;script&gt;");
    });
  });
});
