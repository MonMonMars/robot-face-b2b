#!/usr/bin/env node
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  createExpressionFrame,
  createNeutralBlend,
  createRobotAdapter,
  createSinglePrimitiveBlend,
  EXPRESSION_PRIMITIVES,
  isExpressionPrimitive,
  type ExpressionPrimitive,
} from "@robot-face/sdk";

const PRIMITIVES_HELP = EXPRESSION_PRIMITIVES.join(", ");

async function main(): Promise<void> {
  const robot = createRobotAdapter("mock");
  await robot.connect();

  console.log("Robot Face B2B — mock demo CLI");
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

      const frame = createExpressionFrame(blend, { durationMs: 400 });
      await robot.setExpression(frame);

      const last = mock.state.log.at(-1);
      if (last) console.log(last);
    }
  } finally {
    rl.close();
    await robot.disconnect();
    console.log("Disconnected.");
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
