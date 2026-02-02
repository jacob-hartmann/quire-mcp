import { describe, expect, it } from "vitest";
import { isCorsAllowedPath } from "./cors.js";

describe("isCorsAllowedPath", () => {
  it("allows known OAuth discovery endpoints", () => {
    expect(isCorsAllowedPath("/.well-known/oauth-authorization-server")).toBe(
      true
    );
    expect(isCorsAllowedPath("/.well-known/oauth-protected-resource")).toBe(
      true
    );
  });

  it("allows known OAuth flow endpoints", () => {
    expect(isCorsAllowedPath("/authorize")).toBe(true);
    expect(isCorsAllowedPath("/token")).toBe(true);
    expect(isCorsAllowedPath("/register")).toBe(true);
    expect(isCorsAllowedPath("/oauth/callback")).toBe(true);
  });

  it("allows subpaths for allowed endpoints", () => {
    expect(isCorsAllowedPath("/authorize/")).toBe(true);
    expect(isCorsAllowedPath("/authorize/continue")).toBe(true);
    expect(isCorsAllowedPath("/token/")).toBe(true);
    expect(isCorsAllowedPath("/register/")).toBe(true);
    expect(isCorsAllowedPath("/oauth/callback/")).toBe(true);
  });

  it("rejects prefix-bypass paths that only start with an allowed path", () => {
    expect(isCorsAllowedPath("/authorize-admin")).toBe(false);
    expect(isCorsAllowedPath("/token-info")).toBe(false);
    expect(isCorsAllowedPath("/register-user")).toBe(false);
    expect(isCorsAllowedPath("/oauth/callback-malicious")).toBe(false);
    expect(isCorsAllowedPath("/.well-known/oauth-authorization-server-malicious")).toBe(
      false
    );
  });

  it("rejects unrelated endpoints", () => {
    expect(isCorsAllowedPath("/mcp")).toBe(false);
    expect(isCorsAllowedPath("/")).toBe(false);
  });
});

