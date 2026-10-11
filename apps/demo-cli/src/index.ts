#!/usr/bin/env node
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import WebSocket from "ws";
import {
  appendTokenQuery,
  createExpressionFrame,
  createNeutralBlend,
  createRobotAdapter,
  createSinglePrimitiveBlend,
  EXPRESSION_PRIMITIVES,
  isExpressionPrimitive,
  ResilientStreamClient,
  type ExpressionPrimitive,
  type StreamWebSocketLike,
  type PlaybackProgressSnapshot,
  type StreamConnectionState,
  type WireClientMessage,
  type WireServerMessage,
} from "@robot-face/sdk";

const PRIMITIVES_HELP = EXPRESSION_PRIMITIVES.join(", ");

function parseArgs(argv: string[]): { streamUrl?: string; streamToken?: string } {
  const out: { streamUrl?: string; streamToken?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--stream" && argv[i + 1]) out.streamUrl = argv[++i];
    if (argv[i] === "--token" && argv[i + 1]) out.streamToken = argv[++i];
  }
  return out;
}

function formatConnState(state: StreamConnectionState): string {
  switch (state) {
    case "connected":
      return "connected";
    case "connecting":
      return "connecting…";
    case "reconnecting":
      return "reconnecting (backoff)…";
    case "disconnected":
      return "disconnected";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

async function runLocal(): Promise<void> {
  const robot = createRobotAdapter("mock");
  await robot.connect();

  console.log("Robot Face B2B — mock demo CLI (in-process)");
  console.log(`Commands: <expression> [intensity 0-1] | neutral | quit`);
  console.log(`Expressions: ${PRIMITIVES_HELP}\n`);

  const rl = readline.createInterface({ input, output });
  const mock = robot as import("@robot-face/sdk").MockRobotAdapter;

  try {
    for (;;) {
      const line = (await rl.question("expression> ")).trim();
      if (!line) continue;
      if (line === "quit" || line === "exit") break;

      const [cmd, intensityRaw] = line.split(/\s+/);
      const intensity = intensityRaw ? Number.parseFloat(intensityRaw) : 1;

      let primitive: ExpressionPrimitive;
      if (cmd === "neutral" || cmd === "idle") {
        primitive = "neutral";
      } else if (isExpressionPrimitive(cmd)) {
        primitive = cmd;
      } else {
        console.log(`Unknown expression "${cmd}". Try: ${PRIMITIVES_HELP}`);
        continue;
      }

      const blend =
        primitive === "neutral"
          ? createNeutralBlend(intensity)
          : createSinglePrimitiveBlend(primitive, intensity);

      await robot.setExpression(createExpressionFrame(blend, { durationMs: 400 }));
      const last = mock.state.log.at(-1);
      if (last) console.log(last);
    }
  } finally {
    rl.close();
    await robot.disconnect();
  }
}

async function runStream(streamUrl: string, streamToken?: string): Promise<void> {
  const url = appendTokenQuery(streamUrl, streamToken);
  console.log(`Robot Face B2B — CLI over WebSocket stream`);
  console.log(`Server: ${streamUrl}`);
  console.log(`Auto-reconnect: on (exponential backoff)`);
  console.log(
    `Commands: <expression> [intensity] | pause | resume | seek <ms> | stop | status | quit\n`,
  );

  let lastProgress: PlaybackProgressSnapshot | undefined;
  let connState: StreamConnectionState = "disconnected";

  const streamClient = new ResilientStreamClient({
    url,
    autoReconnect: true,
    initialBackoffMs: 1000,
    maxBackoffMs: 30_000,
    webSocketFactory: (targetUrl): StreamWebSocketLike =>
      new WebSocket(targetUrl) as unknown as StreamWebSocketLike,
    onConnectionStateChange: (state) => {
      connState = state;
      console.log(`[stream] ${formatConnState(state)}`);
    },
    onMessage: (msg: WireServerMessage) => {
      if (msg.type === "hello") {
        console.log(
          `Connected to ${msg.platformLabel} (${msg.adapterId}) auth=${msg.authRequired ? "required" : "off"}`,
        );
      }
      if (msg.type === "frame") {
        const w = msg.frame.blend.weights;
        const top = EXPRESSION_PRIMITIVES.reduce((a, b) => (w[a] >= w[b] ? a : b));
        console.log(`← frame ${top}`);
      }
      if (msg.type === "playbackProgress") {
        lastProgress = msg.progress;
        console.log(
          `← playback ${msg.progress.state} ${Math.round(msg.progress.localTimeMs)}/${msg.progress.durationMs}ms loop=${msg.progress.loop}`,
        );
      }
      if (msg.type === "error") console.error(`Server error: ${msg.message}`);
    },
  });

  await new Promise<void>((resolve) => {
    let settled = false;
    const check = setInterval(() => {
      if (streamClient.isOpen() && !settled) {
        settled = true;
        clearInterval(check);
        resolve();
      }
    }, 100);
    void streamClient.connect().catch(() => undefined);
  });

  try {
    await runStreamInteractive(streamClient, () => connState, () => lastProgress);
  } finally {
    streamClient.close();
  }
}

async function runStreamInteractive(
  streamClient: ResilientStreamClient,
  getConnState: () => StreamConnectionState,
  getLastProgress: () => PlaybackProgressSnapshot | undefined,
): Promise<void> {
  const send = (command: WireClientMessage): void => {
    streamClient.send(command);
  };

  const rl = readline.createInterface({ input, output });
  try {
    for (;;) {
      const line = (await rl.question("expression> ")).trim();
      if (!line) continue;
      if (line === "quit" || line === "exit") break;

      if (line === "status") {
        console.log(
          `Connection: ${formatConnState(getConnState())} open=${streamClient.isOpen()}`,
        );
        continue;
      }
      if (line === "pause") {
        send({ type: "pausePlayback" });
        continue;
      }
      if (line === "resume") {
        send({ type: "resumePlayback" });
        continue;
      }
      if (line === "stop") {
        send({ type: "stopPlayback" });
        continue;
      }
      if (line.startsWith("seek ")) {
        const ms = Number.parseInt(line.slice(5).trim(), 10);
        if (!Number.isNaN(ms)) {
          send({ type: "seekPlayback", localTimeMs: ms });
        }
        continue;
      }

      const [cmd, intensityRaw] = line.split(/\s+/);
      const intensity = intensityRaw ? Number.parseFloat(intensityRaw) : 1;

      let primitive: ExpressionPrimitive;
      if (cmd === "neutral" || cmd === "idle") {
        primitive = "neutral";
      } else if (isExpressionPrimitive(cmd)) {
        primitive = cmd;
      } else {
        console.log(`Unknown command "${cmd}".`);
        continue;
      }

      const blend =
        primitive === "neutral"
          ? createNeutralBlend(intensity)
          : createSinglePrimitiveBlend(primitive, intensity);

      send({
        type: "setExpression",
        frame: createExpressionFrame(blend, { durationMs: 400 }),
      });
    }
  } finally {
    rl.close();
    const lastProgress = getLastProgress();
    if (lastProgress) {
      console.log(
        `Last playback: ${lastProgress.state} @ ${lastProgress.localTimeMs}ms`,
      );
    }
    console.log("Disconnected.");
  }
}

async function main(): Promise<void> {
  const { streamUrl, streamToken } = parseArgs(process.argv.slice(2));
  if (streamUrl) {
    await runStream(streamUrl, streamToken);
  } else {
    await runLocal();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
