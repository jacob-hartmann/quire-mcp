/**
 * Resource Template Completions
 *
 * Provides completion callbacks for resource template variables.
 * These callbacks help clients autocomplete resource URIs.
 *
 * Note: MCP SDK's CompleteResourceTemplateCallback does not receive
 * the request context with auth info, so completions use the fallback
 * auth chain (env var, cached token, refresh, interactive OAuth).
 * This works well in stdio mode but may not work in HTTP mode.
 */

import type { CompleteResourceTemplateCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClientFromAuth } from "../quire/client.js";

/**
 * Maximum number of suggestions to return
 */
const MAX_SUGGESTIONS = 20;

/**
 * Cache for completion results to reduce API calls.
 * Key is cache type (e.g., "projects", "organizations")
 * Value is { data: string[], timestamp: number }
 */
const completionCache = new Map<
  string,
  { data: { id: string; name: string }[]; timestamp: number }
>();

/**
 * Cache TTL in milliseconds (30 seconds)
 */
const CACHE_TTL_MS = 30000;

/**
 * Get cached data or fetch fresh data
 */
async function getCachedOrFetch<T extends { id: string; name: string }>(
  cacheKey: string,
  fetchFn: () => Promise<T[]>
): Promise<T[]> {
  const cached = completionCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data as T[];
  }

  try {
    const data = await fetchFn();
    completionCache.set(cacheKey, { data, timestamp: now });
    return data;
  } catch {
    // If fetch fails but we have stale cache, use it
    if (cached) {
      return cached.data as T[];
    }
    return [];
  }
}

/**
 * Filter and format suggestions based on partial input
 */
function filterSuggestions(
  items: { id: string; name: string }[],
  partialValue: string
): string[] {
  const lowerValue = partialValue.toLowerCase();

  return items
    .filter(
      (item) =>
        item.id.toLowerCase().includes(lowerValue) ||
        item.name.toLowerCase().includes(lowerValue)
    )
    .slice(0, MAX_SUGGESTIONS)
    .map((item) => item.id);
}

/**
 * Create a completion callback for project IDs.
 * Suggests project IDs based on the user's accessible projects.
 */
export function createProjectIdCompleter(): CompleteResourceTemplateCallback {
  return async (value: string): Promise<string[]> => {
    const clientResult = await createClientFromAuth();
    if (!clientResult.success) {
      // Auth not available - return empty suggestions
      return [];
    }

    const projects = await getCachedOrFetch("projects", async () => {
      const result = await clientResult.data.listProjects();
      if (!result.success) return [];
      return result.data.map((p) => ({ id: p.id, name: p.name }));
    });

    return filterSuggestions(projects, value);
  };
}

/**
 * Create a completion callback for organization IDs.
 * Suggests organization IDs based on the user's accessible organizations.
 */
export function createOrganizationIdCompleter(): CompleteResourceTemplateCallback {
  return async (value: string): Promise<string[]> => {
    const clientResult = await createClientFromAuth();
    if (!clientResult.success) {
      // Auth not available - return empty suggestions
      return [];
    }

    const organizations = await getCachedOrFetch("organizations", async () => {
      const result = await clientResult.data.listOrganizations();
      if (!result.success) return [];
      return result.data.map((o) => ({ id: o.id, name: o.name }));
    });

    return filterSuggestions(organizations, value);
  };
}

/**
 * Clear the completion cache.
 * Useful for testing or when data is known to have changed.
 */
export function clearCompletionCache(): void {
  completionCache.clear();
}
