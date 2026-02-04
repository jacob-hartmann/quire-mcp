# Quire MCP Server

[![CI](https://github.com/jacob-hartmann/quire-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jacob-hartmann/quire-mcp/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/jacob-hartmann/quire-mcp/badge.svg)](https://coveralls.io/github/jacob-hartmann/quire-mcp)
[![CodeQL](https://github.com/jacob-hartmann/quire-mcp/actions/workflows/codeql.yml/badge.svg)](https://github.com/jacob-hartmann/quire-mcp/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/jacob-hartmann/quire-mcp/badge)](https://securityscorecards.dev/viewer/?uri=github.com/jacob-hartmann/quire-mcp)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/11880/badge)](https://www.bestpractices.dev/projects/11880)
[![npm version](https://img.shields.io/npm/v/quire-mcp)](https://www.npmjs.com/package/quire-mcp)
[![npm downloads](https://img.shields.io/npm/dm/quire-mcp)](https://www.npmjs.com/package/quire-mcp)
[![License](https://img.shields.io/github/license/jacob-hartmann/quire-mcp)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for the [Quire](https://quire.io/) project management platform.

This server allows AI assistants (like Claude) to interact with your Quire projects, tasks, and data securely.

## Quick Start

### Prerequisites

- Node.js v22 or higher
- A Quire account
- A Quire OAuth app (see [Create a Quire OAuth App](#step-1-create-a-quire-oauth-app))

### Step 1: Create a Quire OAuth App

1. Go to [Quire App Management](https://quire.io/apps/dev)
2. Click **Create new app**
3. Set **Redirect URL** to: `http://localhost:3000/callback`
4. Choose the permission scopes you need
5. Copy the **Development Client ID** and **Development Client Secret**

### Step 2: Configure Your MCP Client

Choose the setup that matches your MCP client:

#### Claude Desktop (Recommended)

Add to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "quire": {
      "command": "npx",
      "args": ["-y", "quire-mcp"],
      "env": {
        "QUIRE_OAUTH_CLIENT_ID": "your-client-id",
        "QUIRE_OAUTH_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

#### Claude Code (CLI)

Add to your Claude Code MCP settings (`~/.claude/mcp.json` or project-level):

```json
{
  "mcpServers": {
    "quire": {
      "command": "npx",
      "args": ["-y", "quire-mcp"],
      "env": {
        "QUIRE_OAUTH_CLIENT_ID": "your-client-id",
        "QUIRE_OAUTH_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

#### Cursor

In Cursor settings, add an MCP server:

```json
{
  "mcpServers": {
    "quire": {
      "command": "npx",
      "args": ["-y", "quire-mcp"],
      "env": {
        "QUIRE_OAUTH_CLIENT_ID": "your-client-id",
        "QUIRE_OAUTH_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

### Step 3: First-Time Authorization

On first use, the server will:

1. Print an authorization URL to the console
2. Wait for you to open that URL in your browser
3. After you grant access, Quire redirects to localhost
4. The server captures the tokens and caches them

Subsequent uses will automatically refresh tokens as needed.

## Transport Modes

The server supports two transport modes: **stdio** (default) and **http**.

### STDIO Mode (Default)

STDIO mode is the simplest setup. The MCP client spawns the server process directly and communicates via JSON-RPC over stdin/stdout.

**How it works:**

1. MCP client spawns `npx quire-mcp` with environment variables
2. On first tool call, if no cached token exists, the server prints an OAuth URL to stderr
3. User opens URL in browser and authorizes
4. Quire redirects to `localhost:3000/callback` where the server captures the token
5. Token is cached to disk for future use

**Token cache locations:**

- Windows: `%APPDATA%\quire-mcp\tokens.json`
- macOS: `~/Library/Application Support/quire-mcp/tokens.json`
- Linux: `~/.config/quire-mcp/tokens.json`

### HTTP Mode

HTTP mode runs an HTTP server with OAuth 2.0 endpoints. Use this when you need:

- A long-running server process
- Multiple clients connecting to the same server
- Deployment to a remote host (e.g., Cloudflare Workers, cloud VMs)

**Important:** In HTTP mode, the server must be running _before_ clients can connect. Environment variables are set on the **server process**, not in client configs.

#### Running HTTP Mode Locally

**Step 1:** Start the server:

```bash
# Using npx
QUIRE_OAUTH_CLIENT_ID=your-client-id \
QUIRE_OAUTH_CLIENT_SECRET=your-client-secret \
MCP_TRANSPORT=http \
npx quire-mcp

# Or using pnpm (for development)
pnpm dev:http
```

The server will output:

```
[quire-mcp] HTTP server listening on 127.0.0.1:3001
[quire-mcp] OAuth metadata: http://localhost:3001/.well-known/oauth-authorization-server
[quire-mcp] MCP endpoint: http://localhost:3001/mcp
```

**Step 2:** Configure your MCP client to connect:

```json
{
  "mcpServers": {
    "quire": {
      "type": "http",
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

**Note:** No `env` section is needed in the client config for HTTP mode—the OAuth credentials are on the server.

**Step 3:** When the MCP client connects, it will:

1. Discover OAuth endpoints via `/.well-known/oauth-authorization-server`
2. Redirect you to authorize with Quire
3. Exchange tokens and establish a session

#### HTTP Mode Environment Variables

| Variable                    | Required | Default                                | Description                       |
| --------------------------- | -------- | -------------------------------------- | --------------------------------- |
| `MCP_TRANSPORT`             | Yes      | `stdio`                                | Set to `http` to enable HTTP mode |
| `QUIRE_OAUTH_CLIENT_ID`     | Yes      | -                                      | Quire OAuth Client ID             |
| `QUIRE_OAUTH_CLIENT_SECRET` | Yes      | -                                      | Quire OAuth Client Secret         |
| `MCP_SERVER_HOST`           | No       | `127.0.0.1`                            | Host to bind the HTTP server      |
| `MCP_SERVER_PORT`           | No       | `3001`                                 | Port for the HTTP server          |
| `MCP_ISSUER_URL`            | No       | `http://localhost:3001`                | Base URL for OAuth endpoints      |
| `QUIRE_OAUTH_REDIRECT_URI`  | No       | `http://localhost:3001/oauth/callback` | Quire OAuth callback URL          |

**Quire App Configuration for HTTP Mode:**
When using HTTP mode, update your Quire app's redirect URL to: `http://localhost:3001/oauth/callback`

### Manual Token Mode

If you have a pre-obtained access token (e.g., from Postman), you can skip OAuth entirely:

```json
{
  "mcpServers": {
    "quire": {
      "command": "npx",
      "args": ["-y", "quire-mcp"],
      "env": {
        "QUIRE_ACCESS_TOKEN": "your-access-token"
      }
    }
  }
}
```

**Note:** Manually-obtained tokens will eventually expire and won't auto-refresh without OAuth credentials.

## Configuration Reference

### All Environment Variables

| Variable                    | Required | Default                          | Description                              |
| --------------------------- | -------- | -------------------------------- | ---------------------------------------- |
| `QUIRE_OAUTH_CLIENT_ID`     | Yes\*    | -                                | Quire OAuth Client ID                    |
| `QUIRE_OAUTH_CLIENT_SECRET` | Yes\*    | -                                | Quire OAuth Client Secret                |
| `QUIRE_ACCESS_TOKEN`        | No       | -                                | Manual token override (skips OAuth flow) |
| `QUIRE_OAUTH_REDIRECT_URI`  | No       | `http://localhost:3000/callback` | OAuth callback URL (stdio mode)          |
| `QUIRE_TOKEN_STORE_PATH`    | No       | Platform default                 | Path to token cache file                 |
| `MCP_TRANSPORT`             | No       | `stdio`                          | Transport mode: `stdio` or `http`        |
| `MCP_SERVER_HOST`           | No       | `127.0.0.1`                      | HTTP server bind address                 |
| `MCP_SERVER_PORT`           | No       | `3001`                           | HTTP server port                         |
| `MCP_ISSUER_URL`            | No       | `http://localhost:3001`          | OAuth issuer URL (HTTP mode)             |

\*Required unless `QUIRE_ACCESS_TOKEN` is set.

## Features

### Tools

The server provides **60+ tools** organized by category:

#### Authentication

| Tool           | Description                                  |
| -------------- | -------------------------------------------- |
| `quire.whoami` | Get the current authenticated user's profile |

#### Organizations

| Tool                       | Description                           |
| -------------------------- | ------------------------------------- |
| `quire.listOrganizations`  | List all accessible organizations     |
| `quire.getOrganization`    | Get organization details by ID or OID |
| `quire.updateOrganization` | Update organization followers         |

#### Projects

| Tool                  | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `quire.listProjects`  | List all projects, optionally filtered by organization |
| `quire.getProject`    | Get project details including task counts              |
| `quire.updateProject` | Update project name, description, icon, and followers  |
| `quire.exportProject` | Export project tasks in JSON or CSV format             |

#### Tasks

| Tool                            | Description                                                      |
| ------------------------------- | ---------------------------------------------------------------- |
| `quire.listTasks`               | List tasks in a project (root-level or subtasks)                 |
| `quire.getTask`                 | Get task details by project+ID or OID                            |
| `quire.createTask`              | Create a new task with optional priority, dates, assignees, tags |
| `quire.updateTask`              | Update task properties                                           |
| `quire.deleteTask`              | Delete a task and its subtasks                                   |
| `quire.searchTasks`             | Search tasks in a project by keyword and filters                 |
| `quire.createTaskAfter`         | Create a task after a specified task                             |
| `quire.createTaskBefore`        | Create a task before a specified task                            |
| `quire.searchFolderTasks`       | Search tasks within a folder                                     |
| `quire.searchOrganizationTasks` | Search tasks across an entire organization                       |

#### Tags

| Tool              | Description                          |
| ----------------- | ------------------------------------ |
| `quire.listTags`  | List all tags in a project           |
| `quire.getTag`    | Get tag details by OID               |
| `quire.createTag` | Create a new tag with name and color |
| `quire.updateTag` | Update tag name or color             |
| `quire.deleteTag` | Delete a tag                         |

#### Comments

| Tool                     | Description                         |
| ------------------------ | ----------------------------------- |
| `quire.listTaskComments` | List all comments on a task         |
| `quire.addTaskComment`   | Add a comment to a task             |
| `quire.updateComment`    | Update comment text                 |
| `quire.deleteComment`    | Delete a comment                    |
| `quire.listChatComments` | List all comments in a chat channel |
| `quire.addChatComment`   | Add a comment to a chat channel     |

#### Users

| Tool                       | Description                           |
| -------------------------- | ------------------------------------- |
| `quire.getUser`            | Get user details by ID, OID, or email |
| `quire.listUsers`          | List all accessible users             |
| `quire.listProjectMembers` | List all members of a project         |

#### Custom Statuses

| Tool                 | Description                       |
| -------------------- | --------------------------------- |
| `quire.listStatuses` | List custom statuses in a project |
| `quire.getStatus`    | Get status details by value       |
| `quire.createStatus` | Create a custom workflow status   |
| `quire.updateStatus` | Update status name or color       |
| `quire.deleteStatus` | Delete a custom status            |

#### External Teams (Partners)

| Tool                 | Description                          |
| -------------------- | ------------------------------------ |
| `quire.getPartner`   | Get external team details            |
| `quire.listPartners` | List all external teams in a project |

#### Documents

| Tool                   | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `quire.createDocument` | Create a document in an organization or project |
| `quire.getDocument`    | Get document content and metadata               |
| `quire.listDocuments`  | List all documents                              |
| `quire.updateDocument` | Update document name or content                 |
| `quire.deleteDocument` | Delete a document                               |

#### Sublists

| Tool                  | Description                        |
| --------------------- | ---------------------------------- |
| `quire.createSublist` | Create a sublist                   |
| `quire.getSublist`    | Get sublist details                |
| `quire.listSublists`  | List all sublists                  |
| `quire.updateSublist` | Update sublist name or description |
| `quire.deleteSublist` | Delete a sublist                   |

#### Chat Channels

| Tool               | Description                               |
| ------------------ | ----------------------------------------- |
| `quire.createChat` | Create a chat channel                     |
| `quire.getChat`    | Get chat channel details                  |
| `quire.listChats`  | List all chat channels                    |
| `quire.updateChat` | Update chat name, description, or members |
| `quire.deleteChat` | Delete a chat channel                     |

#### Key-Value Storage

| Tool                       | Description                    |
| -------------------------- | ------------------------------ |
| `quire.getStorageValue`    | Get a stored value by key      |
| `quire.listStorageEntries` | List storage entries by prefix |
| `quire.putStorageValue`    | Store a value                  |
| `quire.deleteStorageValue` | Delete a stored value          |

#### Notifications

| Tool                     | Description                |
| ------------------------ | -------------------------- |
| `quire.sendNotification` | Send notification to users |

#### Attachments

| Tool                            | Description                           |
| ------------------------------- | ------------------------------------- |
| `quire.uploadTaskAttachment`    | Upload a file attachment to a task    |
| `quire.uploadCommentAttachment` | Upload a file attachment to a comment |

### Resources

The server exposes data as MCP resources:

#### Static Resources

| Resource URI            | Description                          |
| ----------------------- | ------------------------------------ |
| `quire://user/me`       | Current authenticated user's profile |
| `quire://organizations` | List of all accessible organizations |
| `quire://projects`      | List of all accessible projects      |

#### Resource Templates

| Resource URI                           | Description                           |
| -------------------------------------- | ------------------------------------- |
| `quire://project/{id}`                 | Specific project details and metadata |
| `quire://project/{projectId}/tasks`    | Root tasks in a project               |
| `quire://project/{projectId}/tags`     | Tags defined in a project             |
| `quire://project/{projectId}/statuses` | Custom statuses in a project          |

### Prompts

The server provides guided prompts for common workflows:

| Prompt                      | Description                                  |
| --------------------------- | -------------------------------------------- |
| `quire.create-project-plan` | Generate a task plan from a goal description |
| `quire.daily-standup`       | Generate a daily standup summary             |
| `quire.sprint-planning`     | Plan a sprint from the backlog               |
| `quire.task-breakdown`      | Break down a complex task into subtasks      |
| `quire.weekly-summary`      | Generate a weekly progress report            |

## Development

### Setup

```bash
# Clone the repo
git clone https://github.com/jacob-hartmann/quire-mcp.git
cd quire-mcp

# Use the Node.js version from .nvmrc
# (macOS/Linux nvm): nvm install && nvm use
# (Windows nvm-windows): nvm install 22 && nvm use 22
nvm install
nvm use

# Install dependencies
pnpm install

# Copy .env.example and configure
cp .env.example .env
# Edit .env with your OAuth credentials
```

### Running Locally

```bash
# Development mode (stdio, auto-reload)
pnpm dev

# Development mode (http, auto-reload)
pnpm dev:http

# Production build
pnpm build

# Production run
pnpm start        # stdio mode
pnpm start:http   # http mode
```

### Debugging

You can use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to debug the server:

```bash
# Run from source
pnpm inspect

# Run from built output
pnpm inspect:dist
```

`pnpm inspect` loads `.env` automatically via `dotenv` (see `.env.example`).

If you see `Ignored build scripts: esbuild...`, run `pnpm approve-builds` and allow `esbuild`.
In CI we install dependencies with lifecycle scripts disabled (`pnpm install --ignore-scripts`) and then explicitly rebuild only `esbuild` for the production build job.

## Security

See [SECURITY.md](./SECURITY.md) for security policy and reporting vulnerabilities.

## Support

This is a community project provided "as is" with **no guaranteed support**. See [SUPPORT.md](./SUPPORT.md) for details.

## License

MIT © Jacob Hartmann
