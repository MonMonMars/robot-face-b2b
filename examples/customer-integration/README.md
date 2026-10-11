# Customer integration example

Minimal **copy-pasteable** sample for a B2B partner app that:

1. Connects to the Robot Face **stream server** (mock adapter by default).
2. Subscribes to expression **frames** over WebSocket.
3. Sends a **built-in preset sequence** to the server.

## Prerequisites

From the **monorepo root**:

```bash
npm install
npm run build -w @robot-face/sdk
```

## Run

**Terminal 1** — stream server (mock robot):

```bash
ADAPTER=mock npm run stream:server
```

**Terminal 2** — this example:

```bash
npm run example:customer
# or: npm run start -w @robot-face/example-customer-integration
```

Optional env:

| Variable | Default | Purpose |
|----------|---------|---------|
| `ROBOT_FACE_STREAM_URL` | `ws://127.0.0.1:8765/stream` | WebSocket URL |
| `ROBOT_FACE_STREAM_TOKEN` | (unset) | Matches server `STREAM_TOKEN` if auth is on |

## Embed in your app

Copy the pattern in [`src/index.ts`](./src/index.ts):

- `ResilientStreamClient` + `webSocketFactory` (Node `ws` package).
- `appendTokenQuery` when the server requires a token.
- Wire messages: `playSequence`, `setExpression`, playback control — see SDK `wire-protocol.ts`.

Install the SDK from npm once published:

```bash
npm install @robot-face/sdk ws
```

In this monorepo, the example depends on `@robot-face/sdk@0.1.0` (resolved to the local workspace package).
