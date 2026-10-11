# Contributing to Robot Face B2B

Thanks for helping improve the SDK, stream server, and control studio.

## Local setup

**Requirements:** Node.js 20+, npm 10+

```bash
git clone https://github.com/MonMonMars/robot-face-b2b.git
cd robot-face-b2b
npm install
npm run build
npm test
npm run test:integration
npm run lint
```

Optional checks:

| Command | Purpose |
|---------|---------|
| `npm run stack:up` | Docker demo (stream + studio) |
| `npm run test:smoke` | Playwright studio + mock stream |
| `npm run test:smoke:health` | HTTP/WS health smoke (no browser) |
| `npm run docs` | Generate SDK API docs into `docs/api` (not committed) |
| `npm run example:customer` | Partner embed sample |

## Project layout

- `packages/robot-face-sdk` — publishable SDK (`@robot-face/sdk`)
- `apps/stream-server` — WebSocket hub + HTTP (`/`, `/metrics`, `/sequences`)
- `apps/demo-web` — control studio (Vite)
- `apps/demo-cli` — terminal demo
- `examples/customer-integration` — minimal B2B embed sample

## Pull requests

1. **Branch** from `main` (or the active feature branch your team uses).
2. **Scope** — focused changes; conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
3. **Tests** — keep `npm test`, `npm run test:integration`, and `npm run lint` green. CI also runs Playwright smoke and `npm run docs`.
4. **Docs** — update `README.md` and `CHANGELOG.md` (Unreleased) when behavior or ops surface changes.
5. **Do not** commit generated trees (`docs/api/`, `dist/`, Playwright reports) — CI regenerates API docs.
6. **Do not merge your own PR** unless you are the maintainer; open as ready for review when CI is green.

## Stream server env (dev)

| Variable | Default | Notes |
|----------|---------|--------|
| `ADAPTER` | `mock` | Robot adapter id |
| `PORT` | `8765` | HTTP + WS |
| `STREAM_TOKEN` | (off) | Enables auth on WS + HTTP |
| `SEQUENCE_STORE_DIR` | `.robot-face/sequences` | Named sequence library on disk |
| `STREAM_MAX_CLIENTS` | `32` | Connection cap |
| `STREAM_MIN_MESSAGE_MS` | `20` | Per-client message pacing |

## Questions

Open a GitHub issue or comment on the active PR with context and repro steps.
