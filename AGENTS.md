# OpenFlash

## Project boundaries

- The root package is the React 19/Vite client; all backend code belongs in `server/`, its separate Express/PostgreSQL package.
- UI changes must retain the visual direction of ivpn.net and opencode.ai.
- Client entrypoint: `src/main.tsx` -> `src/App.tsx`; application state and local persistence are centralized in `src/hooks/useFlashStoreProvider.tsx`.
- Server entrypoint: `server/src/index.ts`; routes are wired in `server/src/app.ts`.
- Both packages use strict TypeScript. Server TypeScript is NodeNext, so local runtime imports use `.js` specifiers even when source files are `.ts`.

## Development and verification

- Install both dependency trees: `npm install` and `npm install --prefix server`.
- Copy `server/.env.example` to `server/.env` and set `DATABASE_URL`; the server initializes its PostgreSQL schema on startup.
- Run the client with `npm run dev` (`http://localhost:5173`) and the API with `npm run dev:server` (`http://localhost:3001`). Vite proxies `/api` to that API server.
- Run the full required check with `npm run check`; it type-checks both packages, runs server tests, and builds the client.
- Run one server test from the repository root with `npx --prefix server tsx --test server/test/<name>.test.ts`.
- The integration test is skipped unless `TEST_DATABASE_URL` is set. It truncates `users` in that database, so point it only at a disposable test database.

## Data and security

- Learning data is local-first. Keep card `updatedAt` values, deletion tombstones, and `structureUpdatedAt` correct when changing mutations or sync payloads; server conflict resolution depends on them.
- AI provider keys and configurations are account-scoped: cache them by account ID and sync only through `/api/settings/providers`, never through learning snapshots or backups. Themes and general settings remain local. Server-side TOTP and provider secrets are encrypted before persistence.
- Treat every request body, URL, and provider URL as untrusted. Use the server validation utilities and preserve the middleware protections in `server/src/app.ts` (origin allowlist, Helmet, rate limits, and body-size limits).
- Do not expose `DATABASE_URL`, OAuth credentials, `JWT_SECRET`, or `ENCRYPTION_SECRET` to the client. Production requires independent JWT and encryption secrets, a precise `CLIENT_URLS` allowlist, and `TRUST_PROXY` behind a reverse proxy.

## graphify

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when `graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts.
- Dirty `graphify-out/` files are expected and are not a reason to skip Graphify.
- Use `graphify-out/wiki/index.md` for broad navigation when it exists; otherwise, read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or if scoped queries are insufficient.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
