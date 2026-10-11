import type { IncomingMessage } from "node:http";

export interface StreamServerGuardConfig {
  /** Max concurrent WebSocket clients (0 = unlimited). Default 32. */
  maxClients: number;
  /** Minimum ms between inbound messages per client (0 = off). Default 20. */
  minMessageIntervalMs: number;
}

export function readStreamServerGuardConfig(
  env: NodeJS.ProcessEnv = process.env,
): StreamServerGuardConfig {
  const maxRaw = env.STREAM_MAX_CLIENTS ?? "32";
  const maxClients = Number.parseInt(maxRaw, 10);
  const intervalRaw = env.STREAM_MIN_MESSAGE_MS ?? "20";
  const minMessageIntervalMs = Number.parseInt(intervalRaw, 10);
  return {
    maxClients: Number.isNaN(maxClients) ? 32 : maxClients,
    minMessageIntervalMs: Number.isNaN(minMessageIntervalMs)
      ? 20
      : minMessageIntervalMs,
  };
}

export class StreamConnectionGuard {
  private activeClients = 0;

  constructor(private readonly config: StreamServerGuardConfig) {}

  canAcceptConnection(): boolean {
    if (this.config.maxClients <= 0) return true;
    return this.activeClients < this.config.maxClients;
  }

  registerClient(): void {
    this.activeClients += 1;
  }

  unregisterClient(): void {
    this.activeClients = Math.max(0, this.activeClients - 1);
  }

  getActiveClients(): number {
    return this.activeClients;
  }

  checkMessageRate(lastMessageAt: number): boolean {
    if (this.config.minMessageIntervalMs <= 0) return true;
    return Date.now() - lastMessageAt >= this.config.minMessageIntervalMs;
  }
}

export function clientIp(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]?.trim() ?? "unknown";
  return req.socket.remoteAddress ?? "unknown";
}
