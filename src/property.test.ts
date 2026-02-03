/**
 * Property-Based Tests
 *
 * Uses fast-check for fuzzing and property-based testing of critical functions.
 * This helps discover edge cases and ensures invariants hold across random inputs.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { createHash } from "node:crypto";

// Import functions under test
import { escapeHtml } from "./utils/html.js";
import { LRUCache } from "./utils/lru-cache.js";
import { verifyPkceChallenge } from "./server/server-token-store.js";
import { isCorsAllowedPath } from "./server/cors.js";
import { isLocalhost } from "./server/config.js";
import { isOid, parseErrorCode } from "./quire/client.js";
import { isTokenExpired } from "./quire/oauth.js";
import { buildParams } from "./tools/utils.js";

// ---------------------------------------------------------------------------
// escapeHtml - XSS Prevention
// ---------------------------------------------------------------------------

describe("escapeHtml (property-based)", () => {
  it("should never contain unescaped dangerous characters", () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        const escaped = escapeHtml(str);

        // The output should never contain raw <, >, ", or &
        // except in escaped form (&lt;, &gt;, &quot;, &amp;)
        const withoutEntities = escaped
          .replace(/&lt;/g, "")
          .replace(/&gt;/g, "")
          .replace(/&quot;/g, "")
          .replace(/&amp;/g, "");

        expect(withoutEntities).not.toContain("<");
        expect(withoutEntities).not.toContain(">");
        expect(withoutEntities).not.toContain('"');
        // Ampersand in output without being part of entity means double-escaped which is OK
      })
    );
  });

  it("should be idempotent when applied once (no double escaping needed)", () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        const escaped = escapeHtml(str);
        // Safe strings without special chars should remain unchanged
        if (!/[<>&"]/.exec(str)) {
          expect(escaped).toBe(str);
        }
      })
    );
  });

  it("should preserve string length correctly based on escapes", () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        const escaped = escapeHtml(str);
        // Length should increase for each special char:
        // & -> &amp; (+4), < -> &lt; (+3), > -> &gt; (+3), " -> &quot; (+5)
        const ampCount = (str.match(/&/g) ?? []).length;
        const ltCount = (str.match(/</g) ?? []).length;
        const gtCount = (str.match(/>/g) ?? []).length;
        const quotCount = (str.match(/"/g) ?? []).length;

        const expectedLength =
          str.length + ampCount * 4 + ltCount * 3 + gtCount * 3 + quotCount * 5;
        expect(escaped.length).toBe(expectedLength);
      })
    );
  });

  it("should handle unicode strings", () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        const escaped = escapeHtml(str);
        expect(typeof escaped).toBe("string");
      })
    );
  });
});

// ---------------------------------------------------------------------------
// verifyPkceChallenge - OAuth Security
// ---------------------------------------------------------------------------

describe("verifyPkceChallenge (property-based)", () => {
  it("plain method: verifier equals challenge should return true", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 43, maxLength: 128 }), (verifier) => {
        expect(verifyPkceChallenge(verifier, verifier, "plain")).toBe(true);
      })
    );
  });

  it("plain method: different verifier and challenge should return false", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (verifier, challenge) => {
          fc.pre(verifier !== challenge);
          expect(verifyPkceChallenge(verifier, challenge, "plain")).toBe(false);
        }
      )
    );
  });

  it("S256 method: correctly computed challenge should verify", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 43, maxLength: 128 }), (verifier) => {
        // Compute the expected challenge
        const hash = createHash("sha256").update(verifier).digest();
        const challenge = hash
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        expect(verifyPkceChallenge(verifier, challenge, "S256")).toBe(true);
      })
    );
  });

  it("S256 method: wrong challenge should not verify", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 43, maxLength: 128 }),
        fc.string({ minLength: 20, maxLength: 50 }),
        (verifier, wrongChallenge) => {
          // Compute correct challenge to ensure wrongChallenge is different
          const hash = createHash("sha256").update(verifier).digest();
          const correctChallenge = hash
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

          fc.pre(wrongChallenge !== correctChallenge);
          expect(verifyPkceChallenge(verifier, wrongChallenge, "S256")).toBe(
            false
          );
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// isOid - ID Classification Heuristics
// ---------------------------------------------------------------------------

describe("isOid (property-based)", () => {
  it("strings with dots are always OIDs", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-zA-Z0-9]*\.[a-zA-Z0-9.]*$/), (str) => {
        expect(isOid(str)).toBe(true);
      })
    );
  });

  it("strings with underscores are never OIDs", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-zA-Z0-9]*_[a-zA-Z0-9_]*$/), (str) => {
        fc.pre(!str.includes(".")); // Exclude strings with dots
        expect(isOid(str)).toBe(false);
      })
    );
  });

  it("all lowercase strings (may have hyphens) are IDs, not OIDs", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9-]+$/), (str) => {
        fc.pre(str.length > 0);
        fc.pre(!str.includes(".")); // No dots
        expect(isOid(str)).toBe(false);
      })
    );
  });

  it("mixed case without dots or underscores are OIDs", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-zA-Z0-9]+$/), (str) => {
        fc.pre(str.length > 0);
        fc.pre(/[A-Z]/.test(str)); // Has at least one uppercase
        fc.pre(!str.includes(".")); // No dots
        fc.pre(!str.includes("_")); // No underscores
        expect(isOid(str)).toBe(true);
      })
    );
  });

  it("returns boolean for any string input", () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        const result = isOid(str);
        expect(typeof result).toBe("boolean");
      })
    );
  });
});

// ---------------------------------------------------------------------------
// LRUCache - Cache Invariants
// ---------------------------------------------------------------------------

describe("LRUCache (property-based)", () => {
  it("size never exceeds maxSize", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.array(fc.tuple(fc.string(), fc.integer()), { maxLength: 500 }),
        (maxSize, operations) => {
          const cache = new LRUCache<number>({ maxSize });

          for (const [key, value] of operations) {
            cache.set(key, value);
            expect(cache.size).toBeLessThanOrEqual(maxSize);
          }
        }
      )
    );
  });

  it("get returns what was set (if not evicted)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 100 }),
        fc.string(),
        fc.integer(),
        (maxSize, key, value) => {
          const cache = new LRUCache<number>({ maxSize });
          cache.set(key, value);
          expect(cache.get(key)).toBe(value);
        }
      )
    );
  });

  it("delete removes the key", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (key, value) => {
        const cache = new LRUCache<number>({ maxSize: 10 });
        cache.set(key, value);
        cache.delete(key);
        expect(cache.has(key)).toBe(false);
        expect(cache.get(key)).toBeUndefined();
      })
    );
  });

  it("clear empties the cache", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.string(), fc.integer()), {
          minLength: 1,
          maxLength: 20,
        }),
        (entries) => {
          const cache = new LRUCache<number>({ maxSize: 100 });
          for (const [key, value] of entries) {
            cache.set(key, value);
          }
          cache.clear();
          expect(cache.size).toBe(0);
        }
      )
    );
  });

  it("most recently accessed item survives eviction", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 3, maxLength: 10 }),
        (keys) => {
          fc.pre(new Set(keys).size === keys.length); // Unique keys
          const cache = new LRUCache<string>({ maxSize: 2 });

          // Set first two
          cache.set(keys[0]!, keys[0]!);
          cache.set(keys[1]!, keys[1]!);

          // Access the first to make it most recent
          cache.get(keys[0]!);

          // Add third, which should evict the second (LRU)
          cache.set(keys[2]!, keys[2]!);

          expect(cache.has(keys[0]!)).toBe(true); // Most recent
          expect(cache.has(keys[1]!)).toBe(false); // Evicted
          expect(cache.has(keys[2]!)).toBe(true); // Just added
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// isTokenExpired - Date Edge Cases
// ---------------------------------------------------------------------------

describe("isTokenExpired (property-based)", () => {
  it("undefined expiresAt is never expired", () => {
    expect(isTokenExpired(undefined)).toBe(false);
  });

  it("dates far in the past are expired", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 946684800000, max: Date.now() - 10 * 60 * 1000 }), // 2000-01-01 to 10 min ago
        (timestamp) => {
          const date = new Date(timestamp);
          expect(isTokenExpired(date.toISOString())).toBe(true);
        }
      )
    );
  });

  it("dates far in the future are not expired", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.now() + 60 * 60 * 1000, max: 4102444800000 }), // 1 hour from now to 2100-01-01
        (timestamp) => {
          const date = new Date(timestamp);
          expect(isTokenExpired(date.toISOString())).toBe(false);
        }
      )
    );
  });

  it("returns boolean for valid ISO date strings", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4102444800000 }), // 1970 to 2100
        (timestamp) => {
          const date = new Date(timestamp);
          const result = isTokenExpired(date.toISOString());
          expect(typeof result).toBe("boolean");
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// isCorsAllowedPath - Path Security
// ---------------------------------------------------------------------------

describe("isCorsAllowedPath (property-based)", () => {
  const ALLOWED_PATHS = [
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-protected-resource",
    "/authorize",
    "/token",
    "/register",
    "/oauth/callback",
  ];

  it("exact allowed paths are allowed", () => {
    for (const path of ALLOWED_PATHS) {
      expect(isCorsAllowedPath(path)).toBe(true);
    }
  });

  it("subpaths of allowed paths are allowed", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOWED_PATHS),
        fc.stringMatching(/^\/[a-z0-9-]+$/),
        (allowedPath, suffix) => {
          expect(isCorsAllowedPath(`${allowedPath}${suffix}`)).toBe(true);
        }
      )
    );
  });

  it("prefix attacks are rejected (e.g., /authorize-admin)", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^-[a-z]+$/), (suffix) => {
        // /authorize-admin should NOT match /authorize
        expect(isCorsAllowedPath(`/authorize${suffix}`)).toBe(false);
        expect(isCorsAllowedPath(`/token${suffix}`)).toBe(false);
        expect(isCorsAllowedPath(`/register${suffix}`)).toBe(false);
      })
    );
  });

  it("random paths are not allowed", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^\/[a-z]{5,20}$/), (path) => {
        fc.pre(!ALLOWED_PATHS.some((allowed) => path.startsWith(allowed)));
        expect(isCorsAllowedPath(path)).toBe(false);
      })
    );
  });

  it("returns boolean for any string", () => {
    fc.assert(
      fc.property(fc.string(), (path) => {
        const result = isCorsAllowedPath(path);
        expect(typeof result).toBe("boolean");
      })
    );
  });
});

// ---------------------------------------------------------------------------
// parseErrorCode - Status Code Mapping
// ---------------------------------------------------------------------------

describe("parseErrorCode (property-based)", () => {
  it("always returns an object with code and retryable", () => {
    fc.assert(
      fc.property(fc.integer({ min: 100, max: 599 }), (status) => {
        const result = parseErrorCode(status);
        expect(result).toHaveProperty("code");
        expect(result).toHaveProperty("retryable");
        expect(typeof result.code).toBe("string");
        expect(typeof result.retryable).toBe("boolean");
      })
    );
  });

  it("4xx errors (except 429) are not retryable", () => {
    fc.assert(
      fc.property(fc.integer({ min: 400, max: 499 }), (status) => {
        fc.pre(status !== 429); // 429 is retryable
        const result = parseErrorCode(status);
        expect(result.retryable).toBe(false);
      })
    );
  });

  it("5xx errors are retryable", () => {
    fc.assert(
      fc.property(fc.integer({ min: 500, max: 599 }), (status) => {
        const result = parseErrorCode(status);
        expect(result.retryable).toBe(true);
      })
    );
  });

  it("specific status codes map to expected codes", () => {
    expect(parseErrorCode(401).code).toBe("UNAUTHORIZED");
    expect(parseErrorCode(403).code).toBe("FORBIDDEN");
    expect(parseErrorCode(404).code).toBe("NOT_FOUND");
    expect(parseErrorCode(429).code).toBe("RATE_LIMITED");
    expect(parseErrorCode(429).retryable).toBe(true);
    expect(parseErrorCode(503).code).toBe("SERVER_ERROR");
  });
});

// ---------------------------------------------------------------------------
// isLocalhost - URL Validation
// ---------------------------------------------------------------------------

describe("isLocalhost (property-based)", () => {
  it("localhost URLs are recognized", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("http", "https"),
        fc.integer({ min: 1, max: 65535 }),
        (protocol, port) => {
          expect(isLocalhost(`${protocol}://localhost:${port}`)).toBe(true);
          expect(isLocalhost(`${protocol}://127.0.0.1:${port}`)).toBe(true);
          expect(isLocalhost(`${protocol}://[::1]:${port}`)).toBe(true);
        }
      )
    );
  });

  it("non-localhost URLs are not recognized as localhost", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("http", "https"),
        fc.stringMatching(/^[a-z]+\.[a-z]{2,}$/), // e.g., example.com
        (protocol, domain) => {
          expect(isLocalhost(`${protocol}://${domain}`)).toBe(false);
        }
      )
    );
  });

  it("invalid URLs return false", () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        fc.pre(!str.includes("://") || !/^https?:\/\//.exec(str));
        expect(isLocalhost(str)).toBe(false);
      })
    );
  });

  it("case insensitive for localhost", () => {
    expect(isLocalhost("http://LOCALHOST:3000")).toBe(true);
    expect(isLocalhost("http://LocalHost:3000")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildParams - Object Filtering
// ---------------------------------------------------------------------------

describe("buildParams (property-based)", () => {
  it("never includes undefined values in result", () => {
    fc.assert(
      fc.property(
        fc.record({
          a: fc.option(fc.string(), { nil: undefined }),
          b: fc.option(fc.integer(), { nil: undefined }),
          c: fc.option(fc.boolean(), { nil: undefined }),
        }),
        (input) => {
          const result = buildParams(input);
          expect(Object.values(result)).not.toContain(undefined);
        }
      )
    );
  });

  it("preserves all defined values", () => {
    fc.assert(
      fc.property(
        fc.record({
          a: fc.string(),
          b: fc.integer(),
          c: fc.boolean(),
        }),
        (input) => {
          const result = buildParams(input);
          expect(result).toEqual(input);
        }
      )
    );
  });

  it("preserves null values", () => {
    fc.assert(
      fc.property(fc.string(), (key) => {
        fc.pre(key.length > 0 && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key));
        const input = { [key]: null };
        const result = buildParams(input);
        expect(result[key]).toBeNull();
      })
    );
  });

  it("preserves falsy values (empty string, zero, false)", () => {
    const input = {
      emptyStr: "",
      zero: 0,
      falseVal: false,
    };
    const result = buildParams(input);
    expect(result).toEqual(input);
  });

  it("empty input produces empty output", () => {
    expect(buildParams({})).toEqual({});
  });

  it("all undefined produces empty output", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
        (keys) => {
          const uniqueKeys = [...new Set(keys)];
          const input: Record<string, undefined> = {};
          for (const key of uniqueKeys) {
            input[key] = undefined;
          }
          const result = buildParams(input);
          expect(Object.keys(result).length).toBe(0);
        }
      )
    );
  });
});
