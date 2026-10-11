# Changelog

All notable changes to this project are documented here. Versioning follows [SemVer](https://semver.org/).

## [Unreleased]

### Added

- TypeDoc API reference at `docs/api` (`npm run docs`).
- Playwright studio smoke test and `scripts/smoke-health.mjs`.
- Stream **`presence`** / client **`identify`** wire messages; studio shows connected client count.
- Studio keyboard shortcuts (pause/resume, seek, play timeline).

## [0.1.0] - 2026-10-11

### Added

- **`@robot-face/sdk` 0.1.0** — expression primitives, blends, frames, keyframes, playback engine, presets, wire protocol, stream hub/client, resilient reconnect client, session record/replay helpers, mock/Unitree/humanoid adapters (dry-run stubs).
- **`@robot-face/stream-server`** — WebSocket `/stream`, optional `STREAM_TOKEN`, connection guards (`STREAM_MAX_CLIENTS`, `STREAM_MIN_MESSAGE_MS`).
- **Control studio** (`demo-web`) — stream/local modes, timeline editor, canvas preview, session recording export/replay.
- **Demo CLI** — in-process mock and `--stream` mode with auto-reconnect.
- **Docker Compose** — `npm run stack:up` for mock stream + studio.
- **Examples** — [examples/customer-integration](./examples/customer-integration/) partner embed sample.
- **Docs** — root README demo path, [PUBLISH.md](./packages/robot-face-sdk/PUBLISH.md) for npm packaging.

### Notes

- No verified Unitree/Tesla OEM wire protocol in-tree; bridges are configurable HTTP/WebSocket JSON with dry-run defaults.
- B2B tenancy, billing, and fleet registry are out of scope for 0.1.0.

[0.1.0]: https://github.com/MonMonMars/robot-face-b2b/releases/tag/v0.1.0
