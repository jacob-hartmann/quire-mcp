/**
 * quire.whoami Tool
 *
 * Get the current authenticated user's profile from Quire.
 * This tool is useful for verifying that authentication is working
 * and for getting basic information about the current user.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getQuireClient } from "../quire/client-factory.js";

/**
 * Register the quire.whoami tool
 */
export function registerWhoamiTool(server: McpServer): void {
  server.registerTool(
    "quire.whoami",
    {
      description:
        "Get the current authenticated user's profile from Quire. " +
        "Use this to verify your authentication is working and to see " +
        "basic information about the connected Quire account.",
    },
    async (extra) => {
      // Get client using HTTP auth or fallback to stdio auth
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Authentication Error: ${clientResult.error}`,
            },
          ],
        };
      }

      // Fetch user profile
      const userResult = await clientResult.client.getMe();
      if (!userResult.success) {
        const error = userResult.error;
        let errorMessage = error.message;

        // Add helpful context based on error code
        switch (error.code) {
          case "UNAUTHORIZED":
            errorMessage =
              "Your access token is invalid or expired. " +
              "Delete the cached tokens and re-authorize via OAuth.";
            break;
          case "FORBIDDEN":
            errorMessage =
              "Your access token does not have permission to access this resource. " +
              "Check that your Quire app has the required scopes.";
            break;
          case "RATE_LIMITED":
            errorMessage =
              "You have exceeded Quire's rate limit. " +
              "Please wait a moment before trying again. " +
              "(Free plan: 25 requests/minute, 120 requests/hour)";
            break;
        }

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Quire API Error (${error.code}): ${errorMessage}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(userResult.data, null, 2),
          },
        ],
      };
    }
  );
}
