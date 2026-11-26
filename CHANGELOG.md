# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

### Security

## [1.0.5] - 2026-11-26

Dependency and CI maintenance release. No changes to the MCP tool, resource, or prompt surface: the `initialize`, `tools/list`, `resources/list`, `resources/templates/list` and `prompts/list` responses are identical to 1.0.4.

### Changed

- Bump `@modelcontextprotocol/sdk` from `1.27.1` to `1.32.2` and `zod` from `4.3.6` to `4.6.7`.
- Update `express`, `express-rate-limit`, `helmet` and `dotenv` to their latest releases within the current major versions.
- Update development tooling: eslint, typescript-eslint, vitest, prettier, tsx and tsup (now `9.0.0`).
- Use `express-rate-limit`'s `limit` option instead of the deprecated `max` alias (same behaviour).
- Bump the pinned GitHub Actions used in CI and release workflows.

### Security

- Refresh transitive dependencies to patched versions, including `hono`, `@hono/node-server`, `fast-uri`, `qs` and `path-to-regexp`. `pnpm audit --prod` now reports no known vulnerabilities.

## [1.0.1] - 2026-02-07

### Added

### Changed

- Bump `@modelcontextprotocol/sdk` from `1.25.3` to `1.26.0`.

### Fixed

### Security

## [1.0.0] - 2026-02-04

### Added

- Initial stable release of the Quire MCP server.
- **60+ MCP tools** for Quire operations across organizations, projects, tasks, tags, comments, users, statuses, partners, documents, sublists, chat, storage, notifications, and attachments.
- MCP resource `quire://user/me` for accessing the current user profile.
- HTTP (Streamable HTTP) transport with OAuth support for Cursor/clients.
- Interactive OAuth for stdio mode with local callback server, plus cached token refresh.
- Prompts for common project management workflows.

### Changed

- Quire API client now performs runtime response validation using Zod schemas.
- CI and release pipeline improvements (dependency auditing, SBOM generation, trusted publishing).

### Fixed

- Release pipeline and packaging fixes from the RC cycle (e.g., CLI/bin metadata normalization, HTTP session handling responses, and documentation corrections).

### Security

- Hardened HTTP server defaults (restrictive security headers/CSP, safer CORS behavior for OAuth vs MCP endpoints).
