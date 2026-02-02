# Quire MCP Server

[![CI](https://github.com/jacob-hartmann/quire-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jacob-hartmann/quire-mcp/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/jacob-hartmann/quire-mcp/badge.svg)](https://coveralls.io/github/jacob-hartmann/quire-mcp)](https://coveralls.io/github/jacob-hartmann/quire-mcp)
[![CodeQL](https://github.com/jacob-hartmann/quire-mcp/actions/workflows/codeql.yml/badge.svg)](https://github.com/jacob-hartmann/quire-mcp/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/jacob-hartmann/quire-mcp/badge)](https://securityscorecards.dev/viewer/?uri=github.com/jacob-hartmann/quire-mcp)
[![npm version](https://img.shields.io/npm/v/quire-mcp)](https://www.npmjs.com/package/quire-mcp)
[![npm downloads](https://img.shields.io/npm/dm/quire-mcp)](https://www.npmjs.com/package/quire-mcp)
[![License](https://img.shields.io/github/license/jacob-hartmann/quire-mcp)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for the [Quire](https://quire.io/) project management platform.

This server allows AI assistants (like Claude) to interact with your Quire projects, tasks, and data securely.

## Features

- **Tools**:
  - `quire.whoami`: Get the current authenticated user's profile.
- **Resources**:
  - `quire://user/me`: Access the current user's profile data as a resource.

## Prerequisites

- Node.js v22 or higher
- A Quire account
- A Quire OAuth app (Client ID + Secret)

## Installation

### Step 1: Create a Quire OAuth App

1. Go to [Quire App Management](https://quire.io/apps/dev)
2. Click **Create new app**
3. Set **Redirect URL** to: `http://localhost:3000/callback`
4. Choose the permission scopes you need (at minimum, read access for `whoami`)
5. Copy the **Development Client ID** and **Development Client Secret**

### Step 2: Configure Claude Desktop

Add this configuration to your `claude_desktop_config.json`:

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

### Step 3: First-Time Authorization

On first use, the server will:

1. Print an authorization URL to the console
2. Wait for you to open that URL in your browser
3. After you grant access, Quire redirects to localhost
4. The server captures the tokens and caches them

Subsequent uses will automatically refresh tokens as needed.

### Environment Variables

| Variable                    | Required | Default                          | Description                              |
| --------------------------- | -------- | -------------------------------- | ---------------------------------------- |
| `QUIRE_OAUTH_CLIENT_ID`     | Yes      | -                                | Quire OAuth Client ID                    |
| `QUIRE_OAUTH_CLIENT_SECRET` | Yes      | -                                | Quire OAuth Client Secret                |
| `QUIRE_OAUTH_REDIRECT_URI`  | No       | `http://localhost:3000/callback` | OAuth callback URL                       |
| `QUIRE_TOKEN_STORE_PATH`    | No       | Platform default                 | Path to token cache file                 |
| `QUIRE_ACCESS_TOKEN`        | No       | -                                | Manual token override (skips OAuth flow) |

**Token cache locations:**

- Windows: `%APPDATA%\quire-mcp\tokens.json`
- macOS: `~/Library/Application Support/quire-mcp/tokens.json`
- Linux: `~/.config/quire-mcp/tokens.json`

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

# Build
pnpm build
```

### Debugging

You can use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to debug the server:

```bash
# Run from source
pnpm inspect
```

`pnpm inspect` loads `.env` automatically via `dotenv` (see `.env.example`).

Or run against the built output:

```bash
pnpm inspect:dist
```

If you see `Ignored build scripts: esbuild...`, run `pnpm approve-builds` and allow `esbuild`.
In CI we install dependencies with lifecycle scripts disabled (`pnpm install --ignore-scripts`) and then explicitly rebuild only `esbuild` for the production build job.

## Security

See [SECURITY.md](./SECURITY.md) for security policy and reporting vulnerabilities.

## Support

This is a community project provided "as is" with **no guaranteed support**. See [SUPPORT.md](./SUPPORT.md) for details.

## License

MIT © Jacob Hartmann
