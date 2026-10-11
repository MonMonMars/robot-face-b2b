# Robot Face B2B

**Sales & demo path:** run the full stack in one command, open the studio, and drive a live expression stream — no robot hardware required.

```bash
npm install
npm run stack:up
```

Open **http://localhost:5173** → **Connect** (Stream server mode, default URL) → pick a preset → **Play sequence**. The canvas face preview follows blend weights from the mock adapter over WebSocket.

Stop the stack with `npm run stack:down`.

### Partner integration sample

Minimal embed code for a B2B customer app (stream server + mock adapter):

- [examples/customer-integration](./examples/customer-integration/README.md)
- Run: `ADAPTER=mock npm run stream:server` then `npm run example:customer`

### npm package (`@robot-face/sdk`)

The SDK is version **0.1.0** and publish-ready. Packaging checklist and semver notes:

- [packages/robot-face-sdk/PUBLISH.md](./packages/robot-face-sdk/PUBLISH.md)
- [packages/robot-face-sdk/README.md](./packages/robot-face-sdk/README.md) (package consumer docs)
- [CHANGELOG.md](./CHANGELOG.md)
- Verify tarball locally: `npm run pack:sdk`

---

B2B software for **robot facial expressions** — a typed TypeScript SDK and control studio for humanoid platforms (Unitree-class, Tesla Optimus–class, and custom OEM bridges). Drive normalized expression primitives, keyframed sequences, and realtime streams from your app, CLI, or browser demo.

## Quick start

**Requirements:** Node.js 20+

```bash
npm install
npm run build
npm test
npm run test:integration
```

| Command | Description |
|---------|-------------|
| `npm run stack:up` | **Recommended demo:** Docker Compose — mock stream + studio |
| `npm run stream:server` | WebSocket expression stream + HTTP health (default `:8765`) |
| `npm run demo:web` | Control studio at http://localhost:5173 |
| `npm run demo:cli` | In-process mock CLI |
| `npm run demo:cli -- --stream ws://127.0.0.1:8765/stream` | CLI over live stream (auto-reconnect) |

### Docker Compose (one-command demo stack)

Requires [Docker](https://docs.docker.com/get-docker/) with Compose v2:

```bash
npm run stack:up
# Studio → http://localhost:5173
# Stream  → ws://localhost:8765/stream  (mock adapter)
# Health  → curl http://localhost:8765/
```

Stop with `npm run stack:down`. In the studio, use **Stream server** mode (default URL works from your host browser).

The control studio includes a **canvas face preview** driven by live blend weights and stream frames — no robot hardware needed for demos.

### Stream server + studio (without Docker)

Use two terminals so the web UI and CLI share one adapter over WebSocket:

```bash
# Terminal 1 — robot adapter + WS hub (mock by default)
ADAPTER=mock npm run stream:server
# optional: ADAPTER=unitree UNITREE_ADDRESS=192.168.x.x

# Terminal 2 — control studio (Connection → Stream server)
npm run demo:web
# open http://localhost:5173 — default stream URL ws://127.0.0.1:8765/stream
```

```bash
# Terminal 3 (optional) — CLI on the same stream
npm run demo:cli -- --stream ws://127.0.0.1:8765/stream
```

HTTP health: `curl http://127.0.0.1:8765/` → JSON status. WebSocket path: `/stream`.

### Stream auth (optional)

By default the stream is **open** (local mock dev). To require a shared secret:

```bash
STREAM_TOKEN=your-secret npm run stream:server
```

Clients must pass the token via:

- Query: `ws://127.0.0.1:8765/stream?token=your-secret`
- Header: `Authorization: Bearer your-secret` (CLI `--token your-secret`; studio **Stream token** field)

### Remote playback sync

Server-side `ExpressionPlayback` broadcasts **`playbackProgress`** (state, `localTimeMs`, `durationMs`, loop, sequence id) ~10 Hz while playing/paused. Clients can send:

| Message | Action |
|---------|--------|
| `playSequence` | Start server playback |
| `pausePlayback` / `resumePlayback` | Pause / resume |
| `seekPlayback` | `{ localTimeMs }` scrub |
| `stopPlayback` | Stop |

Studio and CLI reflect progress; CLI stream mode accepts `pause`, `resume`, `seek <ms>`, `stop`, `status`.

Wire schema: `packages/robot-face-sdk/src/stream/wire-protocol.ts`.

### Stream client resilience

`ResilientStreamClient` (SDK) and the control studio / CLI stream mode **auto-reconnect** with exponential backoff when the WebSocket drops. Connection states: `connecting`, `connected`, `reconnecting`, `disconnected`. The studio badge shows reconnect status; the CLI prints `[stream] reconnecting (backoff)…` and queues outbound frames until the socket is open again.

### Session recording & replay

Record demos in the studio (**Session record / replay** → **Start recording** → **Stop & export**) or from code:

```typescript
import { SessionRecorder, SessionReplayer, parseSessionRecording } from "@robot-face/sdk";

const recorder = new SessionRecorder();
recorder.start("sales-demo");
recorder.recordFrame(frame);
recorder.recordCommand({ type: "playSequence", sequence, loop: true });
const json = recorder.exportJson();
```

JSON format (`version: 1`): ordered `events[]` with `kind: "frame" | "command"`, `atMs`, and payload. Import in the studio to **replay** on the canvas and (when connected) re-send commands to the stream.

### Stream server guards

Protect the mock/production stream hub with env-configurable limits (defaults in parentheses):

| Variable | Default | Meaning |
|----------|---------|---------|
| `STREAM_MAX_CLIENTS` | `32` | Max concurrent WebSocket clients (`0` = unlimited) |
| `STREAM_MIN_MESSAGE_MS` | `20` | Min interval between inbound messages per client (`0` = off) |

Over-capacity upgrades receive **503**; fast senders get an `error` wire message. Health JSON includes `maxClients`, `minMessageIntervalMs`, and `activeClients`.

### Unitree OEM bridge (feature flag)

**Default:** dry-run stub (no network). Enable a **configurable HTTP/WebSocket bridge** (your edge translator — not a proprietary Unitree protocol):

```bash
ADAPTER=unitree \
UNITREE_BRIDGE=1 \
UNITREE_BRIDGE_URL=http://127.0.0.1:9870/expression/frame \
UNITREE_BRIDGE_MODE=http \
UNITREE_BRIDGE_DRY_RUN=1 \
npm run stream:server
```

Set `UNITREE_BRIDGE_DRY_RUN=0` only when your bridge endpoint is live. Payload shape (`robot-face.unitree-expression.v1`): see `packages/robot-face-sdk/src/adapters/unitree-bridge-client.ts` and `UnitreeRobotAdapter.mapFrameToUnitreePayload`.

### Humanoid OEM bridge (feature flag)

Same pattern as Unitree — **configurable URL**, **dry-run default**, documented JSON (`robot-face.humanoid-expression.v1`):

```bash
ADAPTER=humanoid-generic \
HUMANOID_BRIDGE=1 \
HUMANOID_BRIDGE_URL=http://127.0.0.1:9841/v1/expression/frame \
HUMANOID_BRIDGE_MODE=http \
HUMANOID_BRIDGE_DRY_RUN=1 \
npm run stream:server
```

See `packages/robot-face-sdk/src/adapters/humanoid-bridge-client.ts`.

## Repository layout

| Path | Purpose |
|------|---------|
| `packages/robot-face-sdk` | Domain model, playback engine, adapters, configs |
| `packages/robot-face-sdk/config/*.example.json` | Sample Unitree / humanoid bridge configs |
| `apps/demo-cli` | Terminal demo |
| `apps/stream-server` | WebSocket server bridging clients → `ExpressionStreamHub` → adapter |
| `apps/demo-web` | Control studio (canvas face preview, timeline editor, stream/local) |
| `docker-compose.yml` | Local demo stack (stream-server + nginx studio) |

## Architecture

```mermaid
flowchart TB
  subgraph clients [Clients]
    WEB[demo-web]
    CLI[demo-cli]
    YOUR[Your B2B app]
  end

  SS[stream-server WS]

  subgraph sdk [@robot-face/sdk]
    HUB[ExpressionStreamHub]
    WIRE[Wire protocol]
    PRE[Presets pack]
    SEQ[Keyframes and sequences]
    PLAY[ExpressionPlayback]
    MODEL[Blend / frames / timing]
    CH[ExpressionStreamChannel]
    REG[Adapter registry]
  end

  subgraph adapters [Adapters]
    MOCK[Mock — full]
    UT[Unitree — dry-run stub]
    HU[Humanoid generic — dry-run stub]
  end

  WEB -->|WS| SS
  CLI -->|WS| SS
  SS --> HUB
  HUB --> WIRE
  WEB -->|local| REG
  YOUR --> PLAY
  YOUR --> HUB
  HUB --> REG
  PRE --> SEQ
  SEQ --> PLAY
  PLAY --> MODEL
  REG --> MOCK
  REG --> UT
  REG --> HU
  MOCK --> CH
  UT --> CH
  HU --> CH
  MODEL --> CH
```

### Expression engine

- **Primitives:** `neutral`, `happiness`, `surprise`, `anger`, `sadness`
- **Blend:** weighted primitives + global **intensity** (`normalizeBlend`)
- **Frames:** blend + **timing** (`durationMs`, easing) + `timestampMs` / `sequenceId`
- **Keyframes & sequences:** ordered poses with holds and easing between keys
- **Playback:** `ExpressionPlayback` samples timelines, supports **loop**, streams frames to any `RobotAdapter`
- **Presets:** `BUILTIN_PRESETS` (idle, greet, alert, empathy, warning loop, thinking loop)

### Adapter contract

```typescript
interface RobotAdapter {
  connect(options?) / disconnect() / isConnected()
  setExpression(frame)
  expressionStream  // pub/sub for realtime control
}
```

| Adapter ID | Status | Notes |
|------------|--------|-------|
| `mock` | Production-ready for dev | Records frames, no hardware |
| `unitree` | Stub + **dry-run** | Set `dryRun: true` in config to log payloads |
| `humanoid-generic` | Stub + **dry-run** | Optimus-class bridge extension point |

### Sample configs

Copy and edit:

- `packages/robot-face-sdk/config/unitree.example.json`
- `packages/robot-face-sdk/config/humanoid-generic.example.json`

```typescript
import { connectAdapterFromConfig, parseAdapterConfig } from "@robot-face/sdk";
import fs from "node:fs";

const config = parseAdapterConfig(
  JSON.parse(fs.readFileSync("unitree.local.json", "utf8")),
);
const robot = await connectAdapterFromConfig(config);
```

## Adding a new robot adapter

1. Extend `RobotAdapterId` in `src/adapters/types.ts`.
2. Implement `BaseStreamingRobotAdapter` (or `RobotAdapter` directly).
3. Map `ExpressionFrame.blend.weights` to vendor actuators in `sendFrameToRobot`.
4. Register in `src/adapters/registry.ts`.
5. Add `config/your-oem.example.json` + `parseAdapterConfig` branch if JSON config is useful.
6. Add unit tests (contract) and an integration test with `dryRun` if hardware is unavailable.

**Unitree extension:** override `mapFrameToUnitreePayload()` then replace `sendFrameToRobot` body with SDK calls.

**Humanoid bridge extension:** override `postFrameToBridge()` to POST `serializeFrameForBridge()` JSON.

## Assumptions (v0.1)

- No verified Unitree/Tesla wire protocol in-tree — dry-run and documented stubs only.
- Rate limits follow `capabilities.maxStreamHz` during playback.
- B2B concerns (auth, tenancy, audit) are out of scope for this slice.

## Roadmap

| Phase | Focus |
|-------|--------|
| **v0.1** (this PR) | SDK, mock demo, presets, playback, dry-run vendor stubs, web studio |
| **v0.2** | WebSocket expression stream server + client SDK |
| **v0.3** | First real Unitree or OEM bridge behind feature flag |
| **v0.4** | Cloud workspace: API keys, robot fleet registry, expression audit log |
| **v0.5** | Designer UI: timeline editor, export sequences, A/B presets |

## License

MIT — see [LICENSE](./LICENSE).
