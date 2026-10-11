#!/usr/bin/env node
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import WebSocket from "ws";
import {
  createExpressionFrame,
  createNeutralBlend,
  createRobotAdapter,
  createSinglePrimitiveBlend,
  EXPRESSION_PRIMITIVES,
  isExpressionPrimitive,
  serializeWireMessage,
  type ExpressionPrimitive,
  type WireServerMessage,
} from "@robot-face/sdk";

const PRIMITIVES_HELP = EXPRESSION_PRIMITIVES.join(", ");

function parseArgs(argv: string[]): { streamUrl?: string } {
  const idx = argv.indexOf("--stream");
  if (idx >= 0 && argv[idx + 1]) {
    return { streamUrl: argv[idx + 1] };
  }
  return {};
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

async function runStream(streamUrl: string): Promise<void> {
  console.log(`Robot Face B2B — CLI over WebSocket stream`);
  console.log(`Server: ${streamUrl}`);
  console.log(`Commands: <expression> [intensity 0-1] | neutral | quit\n`);

  const ws = new WebSocket(streamUrl);

  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString()) as WireServerMessage;
      if (msg.type === "hello") {
        console.log(`Connected to ${msg.platformLabel} (${msg.adapterId})`);
      }
      if (msg.type === "frame") {
        const w = msg.frame.blend.weights;
        const top = EXPRESSION_PRIMITIVES.reduce((a, b) =>
          w[a] >= w[b] ? a : b,
        );
        console.log(`← frame ${top} @ ${(msg.frame.blend.intensity * 100).toFixed(0)}%`);
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

      const frame = createExpressionFrame(blend, { durationMs: 400 });
      ws.send(serializeWireMessage({ type: "setExpression", frame }));
    }
  } finally {
    rl.close();
    ws.close();
    console.log("Disconnected.");
  }
}

async function main(): Promise<void> {
  const { streamUrl } = parseArgs(process.argv.slice(2));
  if (streamUrl) {
    await runStream(streamUrl);
  } else {
    await runLocal();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
