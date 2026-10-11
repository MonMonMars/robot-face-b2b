import {
  appendTokenQuery,
  configToConnectionOptions,
  createExpressionFrame,
  createRobotAdapter,
  ExpressionPlayback,
  ExpressionStreamClient,
  parseAdapterConfig,
  type ExpressionFrame,
  type ExpressionSequence,
  type PlaybackProgressSnapshot,
  type RobotAdapter,
  type RobotAdapterId,
  type WireServerMessage,
} from "@robot-face/sdk";

export type ConnectionMode = "local" | "stream";

export interface ExpressionSession {
  readonly mode: ConnectionMode;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  platformLabel(): string;
  setExpression(frame: ExpressionFrame): Promise<void>;
  playSequence(sequence: ExpressionSequence, loop?: boolean): Promise<void>;
  pausePlayback(): void;
  resumePlayback(): void;
  seekPlayback(localTimeMs: number): void;
  stopPlayback(): void;
  getPlayback(): ExpressionPlayback | null;
  getRemoteProgress(): PlaybackProgressSnapshot | null;
  onServerMessage(cb: (msg: WireServerMessage) => void): () => void;
  onFrame(cb: (frame: ExpressionFrame) => void): () => void;
}

export class LocalExpressionSession implements ExpressionSession {
  readonly mode = "local" as const;
  private robot: RobotAdapter | null = null;
  private readonly playback = new ExpressionPlayback();
  private remoteProgress: PlaybackProgressSnapshot | null = null;

  constructor(
    private readonly adapterId: RobotAdapterId,
    private readonly connectOptions?: Parameters<RobotAdapter["connect"]>[0],
  ) {}

  async connect(): Promise<void> {
    this.robot = createRobotAdapter(this.adapterId);
    await this.robot.connect(this.connectOptions);
  }

  async disconnect(): Promise<void> {
    this.playback.stop();
    await this.robot?.disconnect();
    this.robot = null;
    this.remoteProgress = null;
  }

  isConnected(): boolean {
    return this.robot?.isConnected() ?? false;
  }

  platformLabel(): string {
    return this.robot?.capabilities.platformLabel ?? "—";
  }

  async setExpression(frame: ExpressionFrame): Promise<void> {
    if (!this.robot) throw new Error("Not connected");
    await this.robot.setExpression(frame);
  }

  async playSequence(sequence: ExpressionSequence, loop?: boolean): Promise<void> {
    if (!this.robot) throw new Error("Not connected");
    this.playback.stop();
    await this.playback.playSequence(sequence, this.robot, {
      loop,
      onProgress: (p) => {
        this.remoteProgress = p;
      },
    });
  }

  pausePlayback(): void {
    this.playback.pause();
    this.remoteProgress = this.playback.getSnapshot();
  }

  resumePlayback(): void {
    this.playback.resume();
  }

  seekPlayback(localTimeMs: number): void {
    this.playback.seek(localTimeMs);
    this.remoteProgress = this.playback.getSnapshot();
  }

  stopPlayback(): void {
    this.playback.stop();
    this.remoteProgress = this.playback.getSnapshot();
  }

  getPlayback(): ExpressionPlayback {
    return this.playback;
  }

  getRemoteProgress(): PlaybackProgressSnapshot | null {
    return this.remoteProgress ?? this.playback.getSnapshot();
  }

  onServerMessage(): () => void {
    return () => undefined;
  }

  onFrame(cb: (frame: ExpressionFrame) => void): () => void {
    if (!this.robot) return () => undefined;
    return this.robot.expressionStream.subscribe(cb);
  }
}

export class StreamExpressionSession implements ExpressionSession {
  readonly mode = "stream" as const;
  private client: ExpressionStreamClient | null = null;
  private readonly messageHandlers = new Set<(msg: WireServerMessage) => void>();
  private platform = "Stream server";
  private remoteProgress: PlaybackProgressSnapshot | null = null;

  constructor(
    private readonly streamUrl: string,
    private readonly streamToken?: string,
  ) {}

  async connect(): Promise<void> {
    const url = appendTokenQuery(this.streamUrl, this.streamToken);
    this.client = new ExpressionStreamClient({
      url,
      onMessage: (msg) => {
        if (msg.type === "playbackProgress") {
          this.remoteProgress = msg.progress;
        }
        for (const h of this.messageHandlers) h(msg);
      },
    });
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    this.client?.close();
    this.client = null;
    this.remoteProgress = null;
  }

  isConnected(): boolean {
    return this.client?.isOpen() ?? false;
  }

  platformLabel(): string {
    return this.platform;
  }

  async setExpression(frame: ExpressionFrame): Promise<void> {
    this.client?.send({ type: "setExpression", frame });
  }

  async playSequence(sequence: ExpressionSequence, loop?: boolean): Promise<void> {
    this.client?.send({ type: "playSequence", sequence, loop });
  }

  pausePlayback(): void {
    this.client?.send({ type: "pausePlayback" });
  }

  resumePlayback(): void {
    this.client?.send({ type: "resumePlayback" });
  }

  seekPlayback(localTimeMs: number): void {
    this.client?.send({ type: "seekPlayback", localTimeMs });
  }

  stopPlayback(): void {
    this.client?.send({ type: "stopPlayback" });
  }

  getPlayback(): ExpressionPlayback | null {
    return null;
  }

  getRemoteProgress(): PlaybackProgressSnapshot | null {
    return this.remoteProgress;
  }

  onServerMessage(cb: (msg: WireServerMessage) => void): () => void {
    this.messageHandlers.add(cb);
    return () => this.messageHandlers.delete(cb);
  }

  onFrame(cb: (frame: ExpressionFrame) => void): () => void {
    return this.onServerMessage((msg) => {
      if (msg.type === "hello") {
        this.platform = msg.platformLabel;
      }
      if (msg.type === "frame") cb(msg.frame);
    });
  }
}

export function defaultStreamUrl(): string {
  const loc = globalThis.location;
  if (loc?.hostname) {
    const proto = loc.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${loc.hostname}:8765/stream`;
  }
  return "ws://127.0.0.1:8765/stream";
}

export function adapterConnectOptions(id: RobotAdapterId) {
  if (id === "mock") return undefined;
  if (id === "unitree") {
    return configToConnectionOptions(
      parseAdapterConfig({
        adapterId: "unitree",
        address: "127.0.0.1",
        dryRun: true,
        model: "g1",
      }),
    );
  }
  return configToConnectionOptions(
    parseAdapterConfig({
      adapterId: "humanoid-generic",
      address: "http://127.0.0.1:9840",
      dryRun: true,
      platform: "optimus-class",
    }),
  );
}

export { createExpressionFrame };
