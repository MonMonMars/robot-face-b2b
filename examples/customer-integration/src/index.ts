/**
 * B2B partner minimal integration — stream server + mock adapter.
 *
 * Start server:  ADAPTER=mock npm run stream:server   (repo root)
 * Run example:   npm run example:customer             (repo root)
 */
import WebSocket from "ws";
import {
  appendTokenQuery,
  getPresetById,
  ResilientStreamClient,
  sequenceDurationMs,
  type StreamWebSocketLike,
  type WireServerMessage,
} from "@robot-face/sdk";

const STREAM_URL = process.env.ROBOT_FACE_STREAM_URL ?? "ws://127.0.0.1:8765/stream";
const STREAM_TOKEN = process.env.ROBOT_FACE_STREAM_TOKEN?.trim() || undefined;

function log(msg: WireServerMessage): void {
  switch (msg.type) {
    case "hello":
      console.log(
        `[partner] hello adapter=${msg.adapterId} platform=${msg.platformLabel}`,
      );
      break;
    case "frame": {
      const w = msg.frame.blend.weights;
      const top = Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "?";
      console.log(`[partner] frame dominant=${top}`);
      break;
    }
    case "playbackProgress":
      console.log(
        `[partner] playback ${msg.progress.state} ${Math.round(msg.progress.localTimeMs)}/${msg.progress.durationMs}ms`,
      );
      break;
    case "error":
      console.error(`[partner] server error: ${msg.message}`);
      break;
    default:
      break;
  }
}

async function waitOpen(client: ResilientStreamClient, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (!client.isOpen()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for stream connection");
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function main(): Promise<void> {
  const preset = getPresetById("sales-wave");
  if (!preset?.sequence) {
    throw new Error("Preset sales-wave missing sequence");
  }

  const url = appendTokenQuery(STREAM_URL, STREAM_TOKEN);
  console.log(`[partner] connecting to ${STREAM_URL}`);

  const client = new ResilientStreamClient({
    url,
    autoReconnect: true,
    webSocketFactory: (targetUrl): StreamWebSocketLike =>
      new WebSocket(targetUrl) as unknown as StreamWebSocketLike,
    onMessage: log,
    onConnectionStateChange: (state) => {
      console.log(`[partner] connection ${state}`);
    },
  });

  void client.connect().catch(() => undefined);
  await waitOpen(client);

  console.log(`[partner] playing preset "${preset.id}"`);
  client.send({
    type: "playSequence",
    sequence: preset.sequence,
    loop: false,
  });

  const durationMs = sequenceDurationMs(preset.sequence) + 1500;
  await new Promise((r) => setTimeout(r, durationMs));

  client.send({ type: "stopPlayback" });
  client.close();
  console.log("[partner] done");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
