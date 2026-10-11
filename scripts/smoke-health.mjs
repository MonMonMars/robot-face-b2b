#!/usr/bin/env node
/**
 * Lightweight smoke (no browser): stream health + WebSocket hello/presence.
 * Usage: ADAPTER=mock npm run stream:server &  npm run test:smoke:health
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import WebSocket from "ws";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const HEALTH_URL = process.env.SMOKE_HEALTH_URL ?? "http://127.0.0.1:8765/";
const WS_URL = process.env.SMOKE_WS_URL ?? "ws://127.0.0.1:8765/stream";
const START_SERVER = process.env.SMOKE_START_SERVER === "1";

async function fetchHealth() {
  const res = await fetch(HEALTH_URL);
  if (!res.ok) throw new Error(`Health HTTP ${res.status}`);
  const body = await res.json();
  if (body.service !== "robot-face-stream") {
    throw new Error(`Unexpected health payload: ${JSON.stringify(body)}`);
  }
}

async function wsHelloAndPresence() {
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let sawHello = false;
    let sawPresence = false;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket smoke timeout"));
    }, 10_000);

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "hello") sawHello = true;
      if (msg.type === "presence" && typeof msg.clientCount === "number") {
        sawPresence = true;
      }
      if (sawHello && sawPresence) {
        clearTimeout(timer);
        ws.close();
        resolve();
      }
    });
    ws.on("error", reject);
  });
}

async function main() {
  let child;
  if (START_SERVER) {
    child = spawn("npm", ["run", "stream:server"], {
      cwd: repoRoot,
      env: { ...process.env, ADAPTER: "mock", PORT: "8765", HOST: "127.0.0.1" },
      stdio: "ignore",
    });
    await delay(1500);
  }

  try {
    await fetchHealth();
    await wsHelloAndPresence();
    console.log("smoke-health: ok");
  } finally {
    child?.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error("smoke-health: failed", err);
  process.exit(1);
});
