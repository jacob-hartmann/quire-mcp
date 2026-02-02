/**
 * HTTP Server Integration Tests
 *
 * Tests the HTTP server routes using supertest for real HTTP requests.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Mock the MCP SDK modules
vi.mock("@modelcontextprotocol/sdk/server/express.js", () => ({
  createMcpExpressApp: vi.fn(({ host }: { host: string }) => {
    const app = express();
    // Store host for DNS rebinding check simulation
    app.set("trustedHost", host);
    return app;
  }),
}));

vi.mock("@modelcontextprotocol/sdk/server/auth/router.js", () => ({
  mcpAuthRouter: vi.fn(() => {
    const router = express.Router();
    // Simulate OAuth endpoints
    router.get("/.well-known/oauth-authorization-server", (_req, res) => {
      res.json({
        issuer: "http://127.0.0.1:3001",
        authorization_endpoint: "http://127.0.0.1:3001/authorize",
        token_endpoint: "http://127.0.0.1:3001/token",
      });
    });
    router.get("/authorize", (_req, res) => {
      res.redirect("http://quire.io/oauth/authorize");
    });
    router.post("/token", (_req, res) => {
      res.json({ access_token: "test-token", token_type: "Bearer" });
    });
    return router;
  }),
}));

vi.mock(
  "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js",
  () => ({
    requireBearerAuth: vi.fn(() => {
      return (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        // Simulate auth info
        (req as express.Request & { auth?: { token: string } }).auth = {
          token: auth.replace("Bearer ", ""),
        };
        next();
      };
    }),
  })
);

const mockTransport = {
  sessionId: undefined as string | undefined,
  handleRequest: vi.fn().mockImplementation(async (req, res) => {
    res.json({ jsonrpc: "2.0", result: {}, id: 1 });
  }),
  close: vi.fn().mockResolvedValue(undefined),
  onclose: undefined as (() => void) | undefined,
};

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: vi.fn().mockImplementation((options) => {
    const transport = { ...mockTransport };
    if (options?.onsessioninitialized) {
      // Immediately call with a new session ID
      transport.sessionId = "test-session-" + Date.now();
      setTimeout(() => options.onsessioninitialized(transport.sessionId), 0);
    }
    return transport;
  }),
}));

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
  isInitializeRequest: vi.fn((body) => body?.method === "initialize"),
}));

vi.mock("./quire-oauth-provider.js", () => ({
  QuireProxyOAuthProvider: class MockQuireProxyOAuthProvider {
    constructor(_config: unknown) {}
    verifyToken = vi.fn().mockResolvedValue({ valid: true });
  },
  handleQuireOAuthCallback: vi.fn(),
}));

vi.mock("./server-token-store.js", () => ({
  getServerTokenStore: vi.fn(() => ({
    cleanup: vi.fn(),
    getPendingRequest: vi.fn(),
    consumePendingRequest: vi.fn(),
  })),
}));

import { handleQuireOAuthCallback } from "./quire-oauth-provider.js";
import { escapeHtml } from "../utils/html.js";
import { isCorsAllowedPath } from "./cors.js";
import { LRUCache } from "../utils/lru-cache.js";
import {
  JSONRPC_ERROR_INVALID_REQUEST,
  JSONRPC_ERROR_INTERNAL,
  SESSION_ID_DISPLAY_LENGTH,
} from "../constants.js";

// Create a test app similar to what startHttpServer creates
function createTestApp(): Express {
  const app = express();

  // Security headers via helmet
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  });

  app.use("/oauth", limiter);
  app.use("/mcp", limiter);

  // CORS middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) {
      next();
      return;
    }

    const isAllowed = isCorsAllowedPath(req.path);

    if (isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
      res.setHeader("Access-Control-Max-Age", "86400");

      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }

      next();
      return;
    }

    res.status(403).json({ error: "Cross-origin requests not allowed" });
  });

  // Cache-Control headers
  const noCacheMiddleware: express.RequestHandler = (_req, res, next) => {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  };

  app.use("/oauth", noCacheMiddleware);
  app.use("/mcp", noCacheMiddleware);
  app.use("/authorize", noCacheMiddleware);
  app.use("/token", noCacheMiddleware);
  app.use("/.well-known", noCacheMiddleware);

  // Parse JSON bodies
  app.use(express.json());

  // OAuth callback route
  app.get("/oauth/callback", async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      const errorMsg = typeof error === "string" ? error : "Unknown error";
      const errorDesc =
        typeof error_description === "string" ? error_description : errorMsg;
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Authorization Failed</title></head>
        <body>
          <h1>Authorization Failed</h1>
          <p>${escapeHtml(errorDesc)}</p>
          <p>You can close this window.</p>
        </body>
        </html>
      `);
      return;
    }

    if (typeof code !== "string" || typeof state !== "string") {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Invalid Request</title></head>
        <body>
          <h1>Invalid Request</h1>
          <p>Missing code or state parameter.</p>
        </body>
        </html>
      `);
      return;
    }

    const result = await (
      handleQuireOAuthCallback as ReturnType<typeof vi.fn>
    )();

    if (result && "error" in result) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Authorization Failed</title></head>
        <body>
          <h1>Authorization Failed</h1>
          <p>${escapeHtml(result.errorDescription)}</p>
          <p>You can close this window.</p>
        </body>
        </html>
      `);
      return;
    }

    res.redirect(result?.redirectUrl || "/");
  });

  // Session storage
  interface SessionInfo {
    transport: typeof mockTransport;
    lastActivity: number;
  }

  const sessions = new LRUCache<SessionInfo>({
    maxSize: 1000,
    onEvict: (_sessionId, session) => {
      try {
        session.transport.close();
      } catch {
        // Ignore
      }
    },
  });

  // MCP POST handler
  app.post("/mcp", (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const auth = req.headers.authorization;

    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const isInitialize = req.body?.method === "initialize";

    if (sessionId && sessions.has(sessionId)) {
      // Existing session
      const session = sessions.get(sessionId)!;
      session.lastActivity = Date.now();
      res.json({ jsonrpc: "2.0", result: { existing: true }, id: req.body?.id });
      return;
    }

    if (!sessionId && isInitialize) {
      // New session
      const newSessionId = "session-" + Date.now();
      sessions.set(newSessionId, {
        transport: mockTransport,
        lastActivity: Date.now(),
      });
      res.setHeader("mcp-session-id", newSessionId);
      res.json({
        jsonrpc: "2.0",
        result: { protocolVersion: "2024-11-05" },
        id: req.body?.id,
      });
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: JSONRPC_ERROR_INVALID_REQUEST,
        message: "Bad Request: No valid session ID provided",
      },
      id: null,
    });
  });

  // MCP GET handler (SSE)
  app.get("/mcp", (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const auth = req.headers.authorization;

    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: JSONRPC_ERROR_INVALID_REQUEST,
          message: "Invalid or missing session ID",
        },
        id: null,
      });
      return;
    }

    // Simulate SSE response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write("data: {}\n\n");
    res.end();
  });

  // MCP DELETE handler
  app.delete("/mcp", (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const auth = req.headers.authorization;

    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: JSONRPC_ERROR_INVALID_REQUEST,
          message: "Invalid or missing session ID",
        },
        id: null,
      });
      return;
    }

    sessions.delete(sessionId);
    res.status(204).end();
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

describe("HTTP Server Integration Tests", () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("OAuth Callback Route", () => {
    it("should handle successful OAuth callback with redirect", async () => {
      vi.mocked(handleQuireOAuthCallback).mockResolvedValue({
        redirectUrl: "http://client.example.com/callback?code=abc123",
      });

      const response = await request(app)
        .get("/oauth/callback")
        .query({ code: "auth-code", state: "state-123" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        "http://client.example.com/callback?code=abc123"
      );
    });

    it("should return 400 for OAuth error from provider", async () => {
      const response = await request(app)
        .get("/oauth/callback")
        .query({ error: "access_denied", error_description: "User denied" });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Authorization Failed");
      expect(response.text).toContain("User denied");
    });

    it("should escape HTML in error description", async () => {
      const response = await request(app).get("/oauth/callback").query({
        error: "test",
        error_description: "<script>alert('xss')</script>",
      });

      expect(response.status).toBe(400);
      expect(response.text).not.toContain("<script>");
      expect(response.text).toContain("&lt;script&gt;");
    });

    it("should return 400 for missing code parameter", async () => {
      const response = await request(app)
        .get("/oauth/callback")
        .query({ state: "state-123" });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Invalid Request");
      expect(response.text).toContain("Missing code or state parameter");
    });

    it("should return 400 for missing state parameter", async () => {
      const response = await request(app)
        .get("/oauth/callback")
        .query({ code: "auth-code" });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Missing code or state parameter");
    });

    it("should handle callback processing error", async () => {
      vi.mocked(handleQuireOAuthCallback).mockResolvedValue({
        error: "invalid_grant",
        errorDescription: "Code expired",
      });

      const response = await request(app)
        .get("/oauth/callback")
        .query({ code: "expired-code", state: "state-123" });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Code expired");
    });
  });

  describe("MCP POST Handler", () => {
    it("should reject requests without authorization", async () => {
      const response = await request(app)
        .post("/mcp")
        .send({ jsonrpc: "2.0", method: "initialize", id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should handle initialize request and create session", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", "Bearer test-token")
        .send({ jsonrpc: "2.0", method: "initialize", id: 1 });

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.headers["mcp-session-id"]).toBeDefined();
    });

    it("should reject non-initialize requests without session ID", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", "Bearer test-token")
        .send({ jsonrpc: "2.0", method: "tools/list", id: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(JSONRPC_ERROR_INVALID_REQUEST);
      expect(response.body.error.message).toContain("No valid session ID");
    });

    it("should handle requests with valid session ID", async () => {
      // First create a session
      const initResponse = await request(app)
        .post("/mcp")
        .set("Authorization", "Bearer test-token")
        .send({ jsonrpc: "2.0", method: "initialize", id: 1 });

      const sessionId = initResponse.headers["mcp-session-id"];

      // Then make a request with the session ID
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", "Bearer test-token")
        .set("mcp-session-id", sessionId)
        .send({ jsonrpc: "2.0", method: "tools/list", id: 2 });

      expect(response.status).toBe(200);
      expect(response.body.result.existing).toBe(true);
    });
  });

  describe("MCP GET Handler (SSE)", () => {
    it("should reject requests without authorization", async () => {
      const response = await request(app).get("/mcp");

      expect(response.status).toBe(401);
    });

    it("should reject requests without session ID", async () => {
      const response = await request(app)
        .get("/mcp")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain("Invalid or missing session ID");
    });

    it("should reject requests with invalid session ID", async () => {
      const response = await request(app)
        .get("/mcp")
        .set("Authorization", "Bearer test-token")
        .set("mcp-session-id", "invalid-session");

      expect(response.status).toBe(400);
    });

    it("should handle requests with valid session ID", async () => {
      // First create a session
      const initResponse = await request(app)
        .post("/mcp")
        .set("Authorization", "Bearer test-token")
        .send({ jsonrpc: "2.0", method: "initialize", id: 1 });

      const sessionId = initResponse.headers["mcp-session-id"];

      // Then make SSE request
      const response = await request(app)
        .get("/mcp")
        .set("Authorization", "Bearer test-token")
        .set("mcp-session-id", sessionId);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");
    });
  });

  describe("MCP DELETE Handler", () => {
    it("should reject requests without authorization", async () => {
      const response = await request(app).delete("/mcp");

      expect(response.status).toBe(401);
    });

    it("should reject requests without session ID", async () => {
      const response = await request(app)
        .delete("/mcp")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(400);
    });

    it("should delete valid session", async () => {
      // First create a session
      const initResponse = await request(app)
        .post("/mcp")
        .set("Authorization", "Bearer test-token")
        .send({ jsonrpc: "2.0", method: "initialize", id: 1 });

      const sessionId = initResponse.headers["mcp-session-id"];

      // Delete the session
      const deleteResponse = await request(app)
        .delete("/mcp")
        .set("Authorization", "Bearer test-token")
        .set("mcp-session-id", sessionId);

      expect(deleteResponse.status).toBe(204);

      // Verify session is gone
      const getResponse = await request(app)
        .get("/mcp")
        .set("Authorization", "Bearer test-token")
        .set("mcp-session-id", sessionId);

      expect(getResponse.status).toBe(400);
    });
  });

  describe("CORS Middleware", () => {
    it("should allow requests without origin header", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
    });

    it("should set CORS headers for OAuth endpoints", async () => {
      const response = await request(app)
        .get("/oauth/callback")
        .set("Origin", "http://example.com")
        .query({ code: "test", state: "test" });

      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://example.com"
      );
    });

    it("should handle OPTIONS preflight for OAuth endpoints", async () => {
      const response = await request(app)
        .options("/oauth/callback")
        .set("Origin", "http://example.com");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-methods"]).toContain("GET");
      expect(response.headers["access-control-allow-methods"]).toContain("POST");
    });

    it("should block cross-origin requests to MCP endpoint", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Origin", "http://evil.com")
        .set("Authorization", "Bearer test-token")
        .send({ jsonrpc: "2.0", method: "initialize", id: 1 });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Cross-origin requests not allowed");
    });
  });

  describe("Cache Control Headers", () => {
    it("should set no-cache headers on OAuth endpoints", async () => {
      vi.mocked(handleQuireOAuthCallback).mockResolvedValue({
        redirectUrl: "http://example.com/callback",
      });

      const response = await request(app)
        .get("/oauth/callback")
        .query({ code: "test", state: "test" });

      expect(response.headers["cache-control"]).toContain("no-store");
      expect(response.headers["pragma"]).toBe("no-cache");
    });

    it("should set no-cache headers on MCP endpoint", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", "Bearer test-token")
        .send({ jsonrpc: "2.0", method: "initialize", id: 1 });

      expect(response.headers["cache-control"]).toContain("no-store");
    });
  });

  describe("Security Headers (Helmet)", () => {
    it("should set X-Content-Type-Options header", async () => {
      const response = await request(app).get("/health");

      expect(response.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("should set X-Frame-Options header", async () => {
      const response = await request(app).get("/health");

      expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    });
  });

  describe("Rate Limiting", () => {
    it("should include rate limit headers", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", "Bearer test-token")
        .send({ jsonrpc: "2.0", method: "initialize", id: 1 });

      // Rate limit headers should be present
      expect(response.headers["ratelimit-limit"]).toBeDefined();
      expect(response.headers["ratelimit-remaining"]).toBeDefined();
    });
  });

  describe("Health Check", () => {
    it("should return healthy status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
    });
  });
});
