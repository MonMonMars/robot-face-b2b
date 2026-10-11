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
  serializeWireMessage,
  type ExpressionPrimitive,
  type PlaybackProgressSnapshot,
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
  console.log(`Server: ${url}`);
  console.log(
    `Commands: <expression> [intensity] | pause | resume | seek <ms> | stop | quit\n`,
  );

  const ws = new WebSocket(url);
  let lastProgress: PlaybackProgressSnapshot | undefined;

  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString()) as WireServerMessage;
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
    } catch {
      // ignore
    }
  });

  const rl = readline.createInterface({ input, output });
  try {
    for (;;) {
      const line = (await rl.question("expression> ")).trim();
      if (!line) continue;
      if (line === "quit" || line === "exit") break;

      if (line === "pause") {
        ws.send(serializeWireMessage({ type: "pausePlayback" }));
        continue;
      }
      if (line === "resume") {
        ws.send(serializeWireMessage({ type: "resumePlayback" }));
        continue;
      }
      if (line === "stop") {
        ws.send(serializeWireMessage({ type: "stopPlayback" }));
        continue;
      }
      if (line.startsWith("seek ")) {
        const ms = Number.parseInt(line.slice(5).trim(), 10);
        if (!Number.isNaN(ms)) {
          ws.send(serializeWireMessage({ type: "seekPlayback", localTimeMs: ms }));
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

      ws.send(
        serializeWireMessage({
          type: "setExpression",
          frame: createExpressionFrame(blend, { durationMs: 400 }),
        }),
      );
    }
  } finally {
    rl.close();
    ws.close();
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
