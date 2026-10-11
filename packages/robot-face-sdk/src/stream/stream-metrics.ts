export interface StreamMetricsSnapshot {
  service: "robot-face-stream";
  uptimeSeconds: number;
  startedAt: string;
  adapter: string;
  authEnabled: boolean;
  activeClients: number;
  streamClients: number;
  messagesTotal: number;
  messagesPerSecond: number;
  sequenceStoreDir: string;
}

export class StreamMetricsCollector {
  private readonly startedAt = Date.now();
  private messagesTotal = 0;
  private readonly recentMessageAt: number[] = [];

  recordInboundMessage(): void {
    const now = Date.now();
    this.messagesTotal += 1;
    this.recentMessageAt.push(now);
    const cutoff = now - 60_000;
    while (this.recentMessageAt.length > 0 && this.recentMessageAt[0]! < cutoff) {
      this.recentMessageAt.shift();
    }
  }

  messagesPerSecond(): number {
    const now = Date.now();
    const windowStart = now - 1000;
    let count = 0;
    for (let i = this.recentMessageAt.length - 1; i >= 0; i--) {
      const t = this.recentMessageAt[i]!;
      if (t < windowStart) break;
      count += 1;
    }
    return count;
  }

  snapshot(input: {
    adapter: string;
    authEnabled: boolean;
    activeClients: number;
    streamClients: number;
    sequenceStoreDir: string;
  }): StreamMetricsSnapshot {
    const uptimeMs = Date.now() - this.startedAt;
    return {
      service: "robot-face-stream",
      uptimeSeconds: Math.floor(uptimeMs / 1000),
      startedAt: new Date(this.startedAt).toISOString(),
      adapter: input.adapter,
      authEnabled: input.authEnabled,
      activeClients: input.activeClients,
      streamClients: input.streamClients,
      messagesTotal: this.messagesTotal,
      messagesPerSecond: this.messagesPerSecond(),
      sequenceStoreDir: input.sequenceStoreDir,
    };
  }
}
