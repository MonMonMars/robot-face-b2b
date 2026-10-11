# Robot Face B2B

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
| `npm run demo:cli` | Interactive mock robot CLI |
| `npm run demo:web` | Control studio at http://localhost:5173 |

## Repository layout

| Path | Purpose |
|------|---------|
| `packages/robot-face-sdk` | Domain model, playback engine, adapters, configs |
| `packages/robot-face-sdk/config/*.example.json` | Sample Unitree / humanoid bridge configs |
| `apps/demo-cli` | Terminal demo |
| `apps/demo-web` | Realtime control studio (presets, timeline, blend sliders) |

## Architecture

```mermaid
flowchart TB
  subgraph clients [Clients]
    WEB[demo-web]
    CLI[demo-cli]
    YOUR[Your B2B app]
  end

  subgraph sdk [@robot-face/sdk]
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

  WEB --> REG
  CLI --> REG
  YOUR --> PLAY
  YOUR --> REG
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
