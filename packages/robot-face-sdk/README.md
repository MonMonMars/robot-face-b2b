# @robot-face/sdk

TypeScript SDK for **robot facial expression** control: blend primitives, keyframed sequences, playback, WebSocket streaming, and vendor adapter stubs (mock, Unitree-class, humanoid-generic).

**Version:** 0.1.0 (semver)

## Install

```bash
npm install @robot-face/sdk
```

Requires **Node.js 20+**. Browser apps can import the ESM build; Node stream clients should pass `webSocketFactory` (see below).

## Quick usage

```typescript
import {
  createRobotAdapter,
  createExpressionFrame,
  createSinglePrimitiveBlend,
  getPresetById,
} from "@robot-face/sdk";

const robot = createRobotAdapter("mock");
await robot.connect();

const preset = getPresetById("sales-wave");
if (preset?.sequence) {
  await robot.setExpression(
    createExpressionFrame(createSinglePrimitiveBlend("happiness", 0.9)),
  );
}

await robot.disconnect();
```

## Stream server client (Node)

```typescript
import WebSocket from "ws";
import {
  appendTokenQuery,
  ResilientStreamClient,
  type StreamWebSocketLike,
} from "@robot-face/sdk";

const client = new ResilientStreamClient({
  url: appendTokenQuery("ws://127.0.0.1:8765/stream", process.env.STREAM_TOKEN),
  webSocketFactory: (url) => new WebSocket(url) as unknown as StreamWebSocketLike,
  onMessage: (msg) => {
    if (msg.type === "frame") console.log(msg.frame);
  },
});

await client.connect();
client.send({ type: "stopPlayback" });
client.close();
```

Full partner walkthrough: [examples/customer-integration](../../examples/customer-integration/README.md) in the monorepo.

## Node stream server helpers

Server-only APIs (filesystem sequence library, HTTP routes, metrics) live on the **`@robot-face/sdk/server`** subpath — not in the browser bundle.

```typescript
import { SequenceFilesystemStore, handleStreamHttpRequest } from "@robot-face/sdk/server";
```

## Publishing

Maintainers: see [PUBLISH.md](./PUBLISH.md).

## License

MIT
