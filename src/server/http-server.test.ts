/**
 * HTTP Server Tests
 *
 * Tests the HTTP server creation, middleware configuration, and request handling.
 */

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
      listen: vi.fn(
        (_port: number, _host: string, callback: () => void) => {
          callback();
          return {
            on: vi.fn(),
            close: vi.fn((cb: () => void) => { cb(); }),
          };
        }
      ),
    };
    return app;
  };

  const mockApp = createMockApp();
  const express = Object.assign(vi.fn(() => mockApp), {
    json: vi.fn(() => vi.fn()),
  });
  return { default: express };
});

vi.mock("helmet", () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock("express-rate-limit", () => ({
  default: vi.fn(() => {
    return vi.fn(
      (_req: MockRequest, _res: MockResponse, next: () => void) => { next(); }
    );
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
      listen: vi.fn(
        (_port: number, _host: string, callback: () => void) => {
          callback();
          return {
            on: vi.fn(),
            close: vi.fn((cb: () => void) => { cb(); }),
          };
        }
      ),
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
      () =>
        (
          _req: MockRequest,
          _res: MockResponse,
          next: () => void
        ) =>
          { next(); }
    ),
  })
);

// Mock transport
const mockTransport = {
  sessionId: "test-session-id",
  handleRequest: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  onclose: undefined as (() => void) | undefined,
};

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: vi.fn().mockImplementation((options) => {
    // Call session initialized callback if provided
    if (options?.onsessioninitialized) {
      setTimeout(() => options.onsessioninitialized("new-session-id"), 0);
    }
    return mockTransport;
  }),
}));

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

describe("HTTP Server", () => {
  const mockConfig: HttpServerConfig = {
    host: "127.0.0.1",
    port: 3001,
    issuerUrl: "http://127.0.0.1:3001",
    quireOAuthClientId: "test-client-id",
    quireOAuthClientSecret: "test-client-secret",
  };

  let mockGetServer: Mock;
  let mockServer: {
    connect: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registeredRoutes.clear();

    mockServer = {
      connect: vi.fn().mockResolvedValue(undefined),
    };
    mockGetServer = vi.fn(() => mockServer);
  });

  afterEach(() => {
    vi.resetAllMocks();
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
        contentSecurityPolicy: false,
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
  });

  describe("MCP POST handler", () => {
    beforeEach(async () => {
      // Reset mock transport
      mockTransport.handleRequest.mockClear();
      mockTransport.close.mockClear();
      await startHttpServer(mockGetServer, mockConfig);
    });

    it("should handle initialize request for new session", async () => {
      const { StreamableHTTPServerTransport } = await import(
        "@modelcontextprotocol/sdk/server/streamableHttp.js"
      );

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
      // Should create a StreamableHTTPServerTransport
      expect(StreamableHTTPServerTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionIdGenerator: expect.any(Function),
          onsessioninitialized: expect.any(Function),
        })
      );
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
          message: "Invalid or missing session ID",
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

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Invalid or missing session ID",
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
          message: "Invalid or missing session ID",
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
});
