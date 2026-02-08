/**
 * HTTP Server Tests
 *
 * Tests the HTTP server creation, middleware configuration, and request handling.
 */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-useless-constructor */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

// Mock all external dependencies before importing
vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-123"),
}));

// Store middleware handlers for testing
let corsMiddleware: (
  req: MockRequest,
  res: MockResponse,
  next: () => void
) => void;
let noCacheMiddleware: (
  req: MockRequest,
  res: MockResponse,
  next: () => void
) => void;
let oauthCallbackHandler: (
  req: MockRequest,
  res: MockResponse
) => Promise<void>;
let mcpPostHandler: (req: MockRequest, res: MockResponse) => Promise<void>;
let mcpGetHandler: (req: MockRequest, res: MockResponse) => Promise<void>;
let mcpDeleteHandler: (req: MockRequest, res: MockResponse) => Promise<void>;

// Track registered routes
const registeredRoutes = new Map<string, Map<string, unknown>>();

interface MockRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  query: Record<string, string | string[] | undefined>;
  body: unknown;
}

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  data: unknown;
  status: Mock;
  json: Mock;
  send: Mock;
  redirect: Mock;
  setHeader: Mock;
  end: Mock;
  headersSent: boolean;
}

// Create mock request and response objects
function createMockRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    method: "GET",
    path: "/",
    headers: {},
    query: {},
    body: undefined,
    ...overrides,
  };
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    data: undefined,
    headersSent: false,
    status: vi.fn(function (this: MockResponse, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: MockResponse, data: unknown) {
      this.data = data;
      return this;
    }),
    send: vi.fn(function (this: MockResponse, data: unknown) {
      this.data = data;
      this.headersSent = true;
      return this;
    }),
    redirect: vi.fn(function (this: MockResponse, url: string) {
      this.headers["Location"] = url;
      this.statusCode = 302;
      return this;
    }),
    setHeader: vi.fn(function (
      this: MockResponse,
      name: string,
      value: string
    ) {
      this.headers[name] = value;
      return this;
    }),
    end: vi.fn(function (this: MockResponse) {
      this.headersSent = true;
      return this;
    }),
  };
  return res;
}

// Create mock app inside the mock factory to avoid hoisting issues
vi.mock("express", () => {
  const createMockApp = (): {
    use: Mock;
    get: Mock;
    post: Mock;
    delete: Mock;
    listen: Mock;
  } => {
    const app = {
      use: vi.fn(() => app),
      get: vi.fn((...args: unknown[]) => {
        const path = args[0] as string;
        const handler = args[args.length - 1];
        if (!registeredRoutes.has("GET")) {
          registeredRoutes.set("GET", new Map());
        }
        const getRoutes = registeredRoutes.get("GET");
        if (getRoutes) {
          getRoutes.set(path, handler);
        }
        return app;
      }),
      post: vi.fn((...args: unknown[]) => {
        const path = args[0] as string;
        const handler = args[args.length - 1];
        if (!registeredRoutes.has("POST")) {
          registeredRoutes.set("POST", new Map());
        }
        const postRoutes = registeredRoutes.get("POST");
        if (postRoutes) {
          postRoutes.set(path, handler);
        }
        return app;
      }),
      delete: vi.fn((...args: unknown[]) => {
        const path = args[0] as string;
        const handler = args[args.length - 1];
        if (!registeredRoutes.has("DELETE")) {
          registeredRoutes.set("DELETE", new Map());
        }
        const deleteRoutes = registeredRoutes.get("DELETE");
        if (deleteRoutes) {
          deleteRoutes.set(path, handler);
        }
        return app;
      }),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback();
        return {
          on: vi.fn(),
          close: vi.fn((cb: () => void) => {
            cb();
          }),
        };
      }),
    };
    return app;
  };

  const mockApp = createMockApp();
  const express = Object.assign(
    vi.fn(() => mockApp),
    {
      json: vi.fn(() => vi.fn()),
    }
  );
  return { default: express };
});

vi.mock("helmet", () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock("express-rate-limit", () => ({
  default: vi.fn(() => {
    return vi.fn((_req: MockRequest, _res: MockResponse, next: () => void) => {
      next();
    });
  }),
}));

vi.mock("@modelcontextprotocol/sdk/server/express.js", () => {
  const createMockApp = (): {
    use: Mock;
    get: Mock;
    post: Mock;
    delete: Mock;
    listen: Mock;
  } => {
    const app = {
      use: vi.fn((...args: unknown[]) => {
        // Capture CORS middleware (function with 3 args at path-less position)
        const handler = args[0];
        const path = typeof handler === "string" ? handler : undefined;

        if (typeof handler === "function" && handler.length === 3) {
          // This is the CORS middleware - path-less middleware with (req, res, next)
          corsMiddleware = handler as typeof corsMiddleware;
        }

        // Capture no-cache middleware on specific paths
        if (
          path &&
          args[1] &&
          typeof args[1] === "function" &&
          (args[1] as { length: number }).length === 3
        ) {
          const middleware = args[1] as typeof noCacheMiddleware;
          if (
            [
              "/oauth",
              "/mcp",
              "/authorize",
              "/token",
              "/register",
              "/.well-known",
            ].includes(path)
          ) {
            noCacheMiddleware = middleware;
          }
        }
        return app;
      }),
      get: vi.fn((...args: unknown[]) => {
        const path = args[0] as string;
        const handler = args[args.length - 1] as typeof oauthCallbackHandler;
        if (!registeredRoutes.has("GET")) {
          registeredRoutes.set("GET", new Map());
        }
        const getRoutes = registeredRoutes.get("GET");
        if (getRoutes) {
          getRoutes.set(path, handler);
        }

        if (path === "/oauth/callback") {
          oauthCallbackHandler = handler;
        }
        if (path === "/mcp") {
          mcpGetHandler = handler;
        }
        return app;
      }),
      post: vi.fn((...args: unknown[]) => {
        const path = args[0] as string;
        const handler = args[args.length - 1] as typeof mcpPostHandler;
        if (!registeredRoutes.has("POST")) {
          registeredRoutes.set("POST", new Map());
        }
        const postRoutes = registeredRoutes.get("POST");
        if (postRoutes) {
          postRoutes.set(path, handler);
        }

        if (path === "/mcp") {
          mcpPostHandler = handler;
        }
        return app;
      }),
      delete: vi.fn((...args: unknown[]) => {
        const path = args[0] as string;
        const handler = args[args.length - 1] as typeof mcpDeleteHandler;
        if (!registeredRoutes.has("DELETE")) {
          registeredRoutes.set("DELETE", new Map());
        }
        const deleteRoutes = registeredRoutes.get("DELETE");
        if (deleteRoutes) {
          deleteRoutes.set(path, handler);
        }

        if (path === "/mcp") {
          mcpDeleteHandler = handler;
        }
        return app;
      }),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback();
        return {
          on: vi.fn(),
          close: vi.fn((cb: () => void) => {
            cb();
          }),
        };
      }),
    };
    return app;
  };

  return {
    createMcpExpressApp: vi.fn(() => createMockApp()),
  };
});

vi.mock("@modelcontextprotocol/sdk/server/auth/router.js", () => ({
  mcpAuthRouter: vi.fn(() => vi.fn()),
}));

vi.mock(
  "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js",
  () => ({
    requireBearerAuth: vi.fn(
      () => (_req: MockRequest, _res: MockResponse, next: () => void) => {
        next();
      }
    ),
  })
);

// Track all created transports and the latest one
const allMockTransports: {
  sessionId: string;
  handleRequest: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onclose: (() => void) | undefined;
}[] = [];

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => {
  let counter = 0;

  // Use a class so `new StreamableHTTPServerTransport(...)` works
  class MockStreamableHTTPServerTransport {
    sessionId: string;
    handleRequest: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onclose: (() => void) | undefined;

    constructor(options?: { onsessioninitialized?: (sid: string) => void }) {
      this.sessionId = `session-${++counter}`;
      this.handleRequest = vi.fn().mockResolvedValue(undefined);
      this.close = vi.fn().mockResolvedValue(undefined);
      this.onclose = undefined;
      allMockTransports.push(this);
      // Use queueMicrotask so onsessioninitialized fires after the constructor
      // returns but before any awaited promises, giving the caller time to assign
      // the `transport` variable that the callback closure captures.
      if (options?.onsessioninitialized) {
        const sid = this.sessionId;
        queueMicrotask(() => {
          options.onsessioninitialized!(sid);
        });
      }
    }
  }

  return {
    StreamableHTTPServerTransport: MockStreamableHTTPServerTransport,
  };
});

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
  isInitializeRequest: vi.fn((body) => {
    return body?.method === "initialize";
  }),
}));

vi.mock("./quire-oauth-provider.js", () => ({
  QuireProxyOAuthProvider: class MockQuireProxyOAuthProvider {
    verifyToken = vi.fn().mockResolvedValue({ valid: true });
    constructor(_config: unknown) {
      // Constructor accepts config
    }
  },
  handleQuireOAuthCallback: vi.fn().mockResolvedValue({
    redirectUrl: "http://localhost:3001/callback?code=auth-code",
  }),
}));

vi.mock("./server-token-store.js", () => ({
  getServerTokenStore: vi.fn(() => ({
    cleanup: vi.fn(),
  })),
}));

vi.mock("./cors.js", () => ({
  isCorsAllowedPath: vi.fn((path: string) => {
    return (
      path.startsWith("/oauth") ||
      path.startsWith("/authorize") ||
      path.startsWith("/token") ||
      path.startsWith("/register") ||
      path.startsWith("/.well-known")
    );
  }),
}));

// Import after mocking
import { startHttpServer } from "./http-server.js";
import { handleQuireOAuthCallback } from "./quire-oauth-provider.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { HttpServerConfig } from "./config.js";

/** Get the most recently created mock transport */
function getLatestTransport(): {
  sessionId: string;
  handleRequest: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onclose: (() => void) | undefined;
} {
  return allMockTransports[allMockTransports.length - 1]!;
}

describe("HTTP Server", () => {
  const mockConfig: HttpServerConfig = {
    host: "127.0.0.1",
    port: 3001,
    issuerUrl: "http://127.0.0.1:3001",
    quireClientId: "test-client-id",
    quireClientSecret: "test-client-secret",
    quireRedirectUri: "http://127.0.0.1:3001/callback",
  };

  let mockGetServer: Mock;
  let mockServer: {
    connect: Mock;
  };

  beforeEach(() => {
    registeredRoutes.clear();
    allMockTransports.length = 0;

    mockServer = {
      connect: vi.fn().mockResolvedValue(undefined),
    };
    mockGetServer = vi.fn(() => mockServer);
  });

  describe("startHttpServer", () => {
    it("should start server and register routes", async () => {
      await startHttpServer(mockGetServer, mockConfig);

      const mockApp = vi.mocked(createMcpExpressApp).mock.results[0]?.value;
      expect(mockApp).toBeDefined();

      // Verify routes are registered
      expect(mockApp.get).toHaveBeenCalledWith(
        "/oauth/callback",
        expect.any(Function)
      );
      expect(mockApp.post).toHaveBeenCalledWith(
        "/mcp",
        expect.any(Function),
        expect.any(Function)
      );
      expect(mockApp.get).toHaveBeenCalledWith(
        "/mcp",
        expect.any(Function),
        expect.any(Function)
      );
      expect(mockApp.delete).toHaveBeenCalledWith(
        "/mcp",
        expect.any(Function),
        expect.any(Function)
      );
    });

    it("should listen on configured host and port", async () => {
      await startHttpServer(mockGetServer, mockConfig);

      const mockApp = vi.mocked(createMcpExpressApp).mock.results[0]?.value;
      expect(mockApp.listen).toHaveBeenCalledWith(
        3001,
        "127.0.0.1",
        expect.any(Function)
      );
    });

    it("should apply helmet security middleware", async () => {
      const helmet = await import("helmet");

      await startHttpServer(mockGetServer, mockConfig);

      expect(helmet.default).toHaveBeenCalledWith({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'none'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: false,
      });
    });

    it("should apply rate limiting to oauth and mcp endpoints", async () => {
      const rateLimit = await import("express-rate-limit");

      await startHttpServer(mockGetServer, mockConfig);

      expect(rateLimit.default).toHaveBeenCalledWith({
        windowMs: 60000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: "Too many requests, please try again later" },
      });
    });

    it("should create MCP Express app with host configuration", async () => {
      await startHttpServer(mockGetServer, mockConfig);

      expect(createMcpExpressApp).toHaveBeenCalledWith({
        host: "127.0.0.1",
      });
    });
  });

  describe("OAuth callback handler", () => {
    beforeEach(async () => {
      // Reset the mock return value before each test
      vi.mocked(handleQuireOAuthCallback).mockResolvedValue({
        redirectUrl: "http://localhost:3001/callback?code=auth-code",
      });
      await startHttpServer(mockGetServer, mockConfig);
    });

    it("should handle successful OAuth callback", async () => {
      const req = createMockRequest({
        query: {
          code: "auth-code",
          state: "state-123",
        },
      });
      const res = createMockResponse();

      await oauthCallbackHandler(req, res);

      expect(handleQuireOAuthCallback).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(
        "http://localhost:3001/callback?code=auth-code"
      );
    });

    it("should handle OAuth error from Quire", async () => {
      const req = createMockRequest({
        query: {
          error: "access_denied",
          error_description: "User denied access",
        },
      });
      const res = createMockResponse();

      await oauthCallbackHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalled();
      const html = res.data as string;
      expect(html).toContain("Authorization Failed");
      expect(html).toContain("User denied access");
    });

    it("should handle missing code or state", async () => {
      const req = createMockRequest({
        query: {},
      });
      const res = createMockResponse();

      await oauthCallbackHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalled();
      const html = res.data as string;
      expect(html).toContain("Invalid Request");
      expect(html).toContain("Missing code or state parameter");
    });

    it("should handle callback processing error", async () => {
      vi.mocked(handleQuireOAuthCallback).mockResolvedValueOnce({
        error: "invalid_grant",
        errorDescription: "Authorization code expired",
      });

      const req = createMockRequest({
        query: {
          code: "expired-code",
          state: "state-123",
        },
      });
      const res = createMockResponse();

      await oauthCallbackHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalled();
      const html = res.data as string;
      expect(html).toContain("Authorization Failed");
      expect(html).toContain("Authorization code expired");
    });

    it("should escape HTML in error descriptions", async () => {
      const req = createMockRequest({
        query: {
          error: "test_error",
          error_description: "<script>alert('xss')</script>",
        },
      });
      const res = createMockResponse();

      await oauthCallbackHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      const html = res.data as string;
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("should handle error without description", async () => {
      const req = createMockRequest({
        query: {
          error: "server_error",
        },
      });
      const res = createMockResponse();

      await oauthCallbackHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      const html = res.data as string;
      expect(html).toContain("server_error");
    });

    it("should handle non-string error parameter", async () => {
      const req = createMockRequest({
        query: {
          error: ["error_one", "error_two"] as unknown as string,
        },
      });
      const res = createMockResponse();

      await oauthCallbackHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      const html = res.data as string;
      expect(html).toContain("Unknown error");
    });
  });

  describe("MCP POST handler", () => {
    beforeEach(async () => {
      await startHttpServer(mockGetServer, mockConfig);
    });

    it("should handle initialize request for new session", async () => {
      const req = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: {},
        body: { method: "initialize", params: {} },
      });
      const res = createMockResponse();

      await mcpPostHandler(req, res);

      // Should create new transport and connect server
      expect(mockServer.connect).toHaveBeenCalled();
      // Should have created a transport
      expect(allMockTransports.length).toBe(1);
      expect(allMockTransports[0]!.handleRequest).toHaveBeenCalled();
    });

    it("should reject requests without session ID when not initializing", async () => {
      const req = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: {},
        body: { method: "tools/list" },
      });
      const res = createMockResponse();

      await mcpPostHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
    });
  });

  describe("MCP GET handler", () => {
    beforeEach(async () => {
      await startHttpServer(mockGetServer, mockConfig);
    });

    it("should reject requests without session ID", async () => {
      const req = createMockRequest({
        method: "GET",
        path: "/mcp",
        headers: {},
      });
      const res = createMockResponse();

      await mcpGetHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Missing session ID",
        },
        id: null,
      });
    });

    it("should reject requests with invalid session ID", async () => {
      const req = createMockRequest({
        method: "GET",
        path: "/mcp",
        headers: {
          "mcp-session-id": "invalid-session",
        },
      });
      const res = createMockResponse();

      await mcpGetHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Session not found",
        },
        id: null,
      });
    });
  });

  describe("MCP DELETE handler", () => {
    beforeEach(async () => {
      await startHttpServer(mockGetServer, mockConfig);
    });

    it("should reject requests without session ID", async () => {
      const req = createMockRequest({
        method: "DELETE",
        path: "/mcp",
        headers: {},
      });
      const res = createMockResponse();

      await mcpDeleteHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Missing session ID",
        },
        id: null,
      });
    });
  });

  describe("CORS middleware", () => {
    beforeEach(async () => {
      await startHttpServer(mockGetServer, mockConfig);
    });

    it("should allow requests without origin", () => {
      const req = createMockRequest({
        path: "/mcp",
        headers: {},
      });
      const res = createMockResponse();
      const next = vi.fn();

      corsMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should set CORS headers for allowed paths", () => {
      const req = createMockRequest({
        path: "/oauth/callback",
        headers: {
          origin: "http://example.com",
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      corsMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Origin",
        "http://example.com"
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
      );
      expect(next).toHaveBeenCalled();
    });

    it("should handle OPTIONS preflight requests", () => {
      const req = createMockRequest({
        method: "OPTIONS",
        path: "/authorize",
        headers: {
          origin: "http://example.com",
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      corsMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("should block cross-origin requests to MCP endpoint", () => {
      const req = createMockRequest({
        path: "/mcp",
        headers: {
          origin: "http://evil.com",
        },
      });
      const res = createMockResponse();
      const next = vi.fn();

      corsMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Cross-origin requests not allowed",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Cache control middleware", () => {
    beforeEach(async () => {
      await startHttpServer(mockGetServer, mockConfig);
    });

    it("should set no-cache headers", () => {
      const res = createMockResponse();
      const next = vi.fn();

      noCacheMiddleware(createMockRequest(), res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private"
      );
      expect(res.setHeader).toHaveBeenCalledWith("Pragma", "no-cache");
      expect(res.setHeader).toHaveBeenCalledWith("Expires", "0");
      expect(next).toHaveBeenCalled();
    });
  });

  describe("Session lifecycle", () => {
    beforeEach(async () => {
      await startHttpServer(mockGetServer, mockConfig);
    });

    it("should reuse existing transport for valid session ID", async () => {
      // First, create a session via initialize request
      const initReq = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: {},
        body: { method: "initialize", params: {} },
      });
      const initRes = createMockResponse();
      await mcpPostHandler(initReq, initRes);

      const transport = getLatestTransport();
      const sessionId = transport.sessionId;

      // Now make a request with the session ID
      const req = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: { "mcp-session-id": sessionId },
        body: { method: "tools/list" },
      });
      const res = createMockResponse();
      await mcpPostHandler(req, res);

      // Should call handleRequest on the same transport
      expect(transport.handleRequest).toHaveBeenCalled();
    });

    it("should return 404 for unknown session ID", async () => {
      const req = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: { "mcp-session-id": "unknown-session-id" },
        body: { method: "tools/list" },
      });
      const res = createMockResponse();
      await mcpPostHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Session not found",
        },
        id: null,
      });
    });

    it("should remove session when transport.onclose is called", async () => {
      // Create a session
      const initReq = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: {},
        body: { method: "initialize", params: {} },
      });
      const initRes = createMockResponse();
      await mcpPostHandler(initReq, initRes);

      const transport = getLatestTransport();
      const sessionId = transport.sessionId;

      // Trigger onclose
      if (transport.onclose) {
        transport.onclose();
      }

      // Session should no longer exist
      const req = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: { "mcp-session-id": sessionId },
        body: { method: "tools/list" },
      });
      const res = createMockResponse();
      await mcpPostHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("Error handling", () => {
    beforeEach(async () => {
      await startHttpServer(mockGetServer, mockConfig);
    });

    it("should return 500 when handleRequest throws on existing session", async () => {
      // Create a session
      const initReq = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: {},
        body: { method: "initialize", params: {} },
      });
      const initRes = createMockResponse();
      await mcpPostHandler(initReq, initRes);

      const transport = getLatestTransport();
      const sessionId = transport.sessionId;

      // Make handleRequest throw on next call
      transport.handleRequest.mockRejectedValueOnce(
        new Error("Transport error")
      );

      const req = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: { "mcp-session-id": sessionId },
        body: { method: "tools/list" },
      });
      const res = createMockResponse();
      await mcpPostHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    });

    it("should not send 500 response when headers already sent on POST", async () => {
      // Create a session
      const initReq = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: {},
        body: { method: "initialize", params: {} },
      });
      const initRes = createMockResponse();
      await mcpPostHandler(initReq, initRes);

      const transport = getLatestTransport();
      const sessionId = transport.sessionId;

      // Make handleRequest throw
      transport.handleRequest.mockRejectedValueOnce(
        new Error("Transport error")
      );

      const req = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: { "mcp-session-id": sessionId },
        body: { method: "tools/list" },
      });
      const res = createMockResponse();
      res.headersSent = true;
      await mcpPostHandler(req, res);

      // Should NOT call status/json because headers already sent
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 500 when DELETE handleRequest throws", async () => {
      // Create a session
      const initReq = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: {},
        body: { method: "initialize", params: {} },
      });
      const initRes = createMockResponse();
      await mcpPostHandler(initReq, initRes);

      const transport = getLatestTransport();
      const sessionId = transport.sessionId;

      // Make handleRequest throw
      transport.handleRequest.mockRejectedValueOnce(new Error("Delete error"));

      const req = createMockRequest({
        method: "DELETE",
        path: "/mcp",
        headers: { "mcp-session-id": sessionId },
      });
      const res = createMockResponse();
      await mcpDeleteHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Error processing session termination",
        },
        id: null,
      });
    });

    it("should not send response when DELETE throws and headers already sent", async () => {
      // Create a session
      const initReq = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: {},
        body: { method: "initialize", params: {} },
      });
      const initRes = createMockResponse();
      await mcpPostHandler(initReq, initRes);

      const transport = getLatestTransport();
      const sessionId = transport.sessionId;

      // Make handleRequest throw
      transport.handleRequest.mockRejectedValueOnce(new Error("Delete error"));

      const req = createMockRequest({
        method: "DELETE",
        path: "/mcp",
        headers: { "mcp-session-id": sessionId },
      });
      const res = createMockResponse();
      res.headersSent = true;
      await mcpDeleteHandler(req, res);

      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("Global error handler", () => {
    let errorHandler: (
      err: Error,
      req: MockRequest,
      res: MockResponse,
      next: () => void
    ) => void;

    beforeEach(async () => {
      await startHttpServer(mockGetServer, mockConfig);

      // The error handler is registered via app.use with 4-param function
      // It's captured by the mock app — it's the last `use` call with a 4-param function
      const mockApp = vi.mocked(createMcpExpressApp).mock.results[0]?.value;
      const useCalls = mockApp.use.mock.calls;
      for (let i = useCalls.length - 1; i >= 0; i--) {
        const arg = useCalls[i]?.[0];
        if (typeof arg === "function" && arg.length === 4) {
          errorHandler = arg as typeof errorHandler;
          break;
        }
      }
    });

    it("should return 500 JSON-RPC error", () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      errorHandler(new Error("Unhandled error"), req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    });

    it("should not send response when headers already sent", () => {
      const req = createMockRequest();
      const res = createMockResponse();
      res.headersSent = true;
      const next = vi.fn();

      errorHandler(new Error("Unhandled error"), req, res, next);

      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("Cleanup and shutdown", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should clean up idle sessions on interval", async () => {
      await startHttpServer(mockGetServer, mockConfig);

      // Create a session
      const initReq = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: {},
        body: { method: "initialize", params: {} },
      });
      const initRes = createMockResponse();
      await mcpPostHandler(initReq, initRes);

      const sessionId = getLatestTransport().sessionId;

      // Advance time past the idle timeout (30 minutes) + cleanup interval (5 minutes)
      await vi.advanceTimersByTimeAsync(35 * 60 * 1000);

      // Try to use the session — it should have been cleaned up
      const req = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: { "mcp-session-id": sessionId },
        body: { method: "tools/list" },
      });
      const res = createMockResponse();
      await mcpPostHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should handle transport.close() rejection during cleanupSession", async () => {
      await startHttpServer(mockGetServer, mockConfig);

      // Create a session
      const initReq = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: {},
        body: { method: "initialize", params: {} },
      });
      const initRes = createMockResponse();
      await mcpPostHandler(initReq, initRes);

      // Make close reject
      getLatestTransport().close.mockRejectedValue(new Error("Close failed"));

      // Advance time past the idle timeout
      await vi.advanceTimersByTimeAsync(35 * 60 * 1000);

      // Should not throw — error is caught
    });

    it("should handle transport.close() throwing synchronously during cleanupSession", async () => {
      await startHttpServer(mockGetServer, mockConfig);

      // Create a session
      const initReq = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: {},
        body: { method: "initialize", params: {} },
      });
      const initRes = createMockResponse();
      await mcpPostHandler(initReq, initRes);

      // Make close throw synchronously
      getLatestTransport().close.mockImplementation(() => {
        throw new Error("Close failed synchronously");
      });

      // Advance time past the idle timeout
      await vi.advanceTimersByTimeAsync(35 * 60 * 1000);

      // Should not throw — error is caught
    });

    it("should shut down gracefully on SIGINT", async () => {
      const processOnSpy = vi.spyOn(process, "on");
      const processExitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await startHttpServer(mockGetServer, mockConfig);

      // Find SIGINT handler
      const sigintCall = processOnSpy.mock.calls.find(
        (call) => call[0] === "SIGINT"
      );
      expect(sigintCall).toBeDefined();

      const sigintHandler = sigintCall![1] as () => void;

      // Create a session first
      const initReq = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: {},
        body: { method: "initialize", params: {} },
      });
      const initRes = createMockResponse();
      await mcpPostHandler(initReq, initRes);

      // Trigger SIGINT
      sigintHandler();

      // Advance past the 5-second forced exit timeout
      await vi.advanceTimersByTimeAsync(5001);

      expect(processExitSpy).toHaveBeenCalledWith(0);

      processOnSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it("should register SIGTERM handler", async () => {
      const processOnSpy = vi.spyOn(process, "on");

      await startHttpServer(mockGetServer, mockConfig);

      const sigtermCall = processOnSpy.mock.calls.find(
        (call) => call[0] === "SIGTERM"
      );
      expect(sigtermCall).toBeDefined();

      processOnSpy.mockRestore();
    });
  });

  describe("LRU eviction", () => {
    it("should handle onEvict when transport.close rejects", async () => {
      // We can't easily test the full LRU eviction with 1001 sessions,
      // so we test the onEvict behavior through the LRU cache directly
      const { LRUCache } = await import("../utils/lru-cache.js");

      const onEvictFn = vi.fn(
        (
          _key: string,
          session: { transport: { close: () => Promise<void> } }
        ) => {
          try {
            session.transport.close().catch(() => {
              // Ignore
            });
          } catch {
            // Ignore close errors on eviction
          }
        }
      );

      const cache = new LRUCache<{
        transport: { close: () => Promise<void> };
      }>({
        maxSize: 2,
        onEvict: onEvictFn,
      });

      const mockTransport1 = {
        close: vi.fn().mockRejectedValue(new Error("Close error")),
      };
      const mockTransport2 = {
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockTransport3 = {
        close: vi.fn().mockResolvedValue(undefined),
      };

      cache.set("session-1", { transport: mockTransport1 });
      cache.set("session-2", { transport: mockTransport2 });
      // This should evict session-1
      cache.set("session-3", { transport: mockTransport3 });

      expect(onEvictFn).toHaveBeenCalledWith("session-1", {
        transport: mockTransport1,
      });
      expect(mockTransport1.close).toHaveBeenCalled();
    });
  });

  describe("GET handler with valid session", () => {
    beforeEach(async () => {
      await startHttpServer(mockGetServer, mockConfig);
    });

    it("should handle GET request with valid session ID", async () => {
      // Create a session
      const initReq = createMockRequest({
        method: "POST",
        path: "/mcp",
        headers: {},
        body: { method: "initialize", params: {} },
      });
      const initRes = createMockResponse();
      await mcpPostHandler(initReq, initRes);

      const sessionId = getLatestTransport().sessionId;

      // GET with valid session
      const req = createMockRequest({
        method: "GET",
        path: "/mcp",
        headers: { "mcp-session-id": sessionId },
      });
      const res = createMockResponse();
      await mcpGetHandler(req, res);

      expect(getLatestTransport().handleRequest).toHaveBeenCalled();
    });
  });

  describe("DELETE handler with valid session", () => {
    beforeEach(async () => {
      await startHttpServer(mockGetServer, mockConfig);
    });

    it("should reject DELETE with unknown session ID", async () => {
      const req = createMockRequest({
        method: "DELETE",
        path: "/mcp",
        headers: { "mcp-session-id": "unknown-id" },
      });
      const res = createMockResponse();
      await mcpDeleteHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
