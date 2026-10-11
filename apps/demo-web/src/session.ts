import {
  appendTokenQuery,
  configToConnectionOptions,
  createExpressionFrame,
  createRobotAdapter,
  ExpressionPlayback,
  parseAdapterConfig,
  ResilientStreamClient,
  type ExpressionFrame,
  type ExpressionSequence,
  type PlaybackProgressSnapshot,
  type RobotAdapter,
  type RobotAdapterId,
  type SessionRecorder,
  type StreamConnectionState,
  type WireClientMessage,
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
  getConnectionState(): StreamConnectionState;
  onConnectionState(cb: (state: StreamConnectionState) => void): () => void;
  attachRecorder(recorder: SessionRecorder | null): void;
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
    this.recordCommand({ type: "setExpression", frame });
    await this.robot.setExpression(frame);
  }

  async playSequence(sequence: ExpressionSequence, loop?: boolean): Promise<void> {
    if (!this.robot) throw new Error("Not connected");
    this.recordCommand({ type: "playSequence", sequence, loop });
    this.playback.stop();
    await this.playback.playSequence(sequence, this.robot, {
      loop,
      onProgress: (p) => {
        this.remoteProgress = p;
      },
    });
  }

  pausePlayback(): void {
    this.recordCommand({ type: "pausePlayback" });
    this.playback.pause();
    this.remoteProgress = this.playback.getSnapshot();
  }

  resumePlayback(): void {
    this.recordCommand({ type: "resumePlayback" });
    this.playback.resume();
  }

  seekPlayback(localTimeMs: number): void {
    this.recordCommand({ type: "seekPlayback", localTimeMs });
    this.playback.seek(localTimeMs);
    this.remoteProgress = this.playback.getSnapshot();
  }

  stopPlayback(): void {
    this.recordCommand({ type: "stopPlayback" });
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
    return this.robot.expressionStream.subscribe((frame) => {
      this.recorder?.recordFrame(frame);
      cb(frame);
    });
  }

  getConnectionState(): StreamConnectionState {
    return this.isConnected() ? "connected" : "disconnected";
  }

  onConnectionState(): () => void {
    return () => undefined;
  }

  private recorder: SessionRecorder | null = null;

  attachRecorder(recorder: SessionRecorder | null): void {
    this.recorder = recorder;
  }

  private recordCommand(command: WireClientMessage): void {
    this.recorder?.recordCommand(command);
  }
}

export class StreamExpressionSession implements ExpressionSession {
  readonly mode = "stream" as const;
  private client: ResilientStreamClient | null = null;
  private readonly messageHandlers = new Set<(msg: WireServerMessage) => void>();
  private readonly stateHandlers = new Set<(state: StreamConnectionState) => void>();
  private platform = "Stream server";
  private remoteProgress: PlaybackProgressSnapshot | null = null;
  private connectionState: StreamConnectionState = "disconnected";
  private recorder: SessionRecorder | null = null;

  constructor(
    private readonly streamUrl: string,
    private readonly streamToken?: string,
  ) {}

  async connect(): Promise<void> {
    const url = appendTokenQuery(this.streamUrl, this.streamToken);
    this.client = new ResilientStreamClient({
      url,
      autoReconnect: true,
      initialBackoffMs: 800,
      maxBackoffMs: 15_000,
      onConnectionStateChange: (state) => {
        this.connectionState = state;
        for (const h of this.stateHandlers) h(state);
      },
      onMessage: (msg) => this.dispatchServerMessage(msg),
    });

    await new Promise<void>((resolve) => {
      const unsub = this.onConnectionState((state) => {
        if (state === "connected") {
          unsub();
          resolve();
        }
      });
      void this.client!.connect().catch(() => {
        // First attempt may fail; auto-reconnect continues until connected.
      });
    });
  }

  private dispatchServerMessage(msg: WireServerMessage): void {
    if (msg.type === "playbackProgress") {
      this.remoteProgress = msg.progress;
    }
    if (msg.type === "frame") {
      this.recorder?.recordFrame(msg.frame);
    }
    for (const h of this.messageHandlers) h(msg);
  }

  async disconnect(): Promise<void> {
    this.client?.close();
    this.client = null;
    this.remoteProgress = null;
    this.connectionState = "disconnected";
  }

  isConnected(): boolean {
    return this.client?.isOpen() ?? false;
  }

  getConnectionState(): StreamConnectionState {
    return this.connectionState;
  }

  onConnectionState(cb: (state: StreamConnectionState) => void): () => void {
    this.stateHandlers.add(cb);
    cb(this.connectionState);
    return () => this.stateHandlers.delete(cb);
  }

  attachRecorder(recorder: SessionRecorder | null): void {
    this.recorder = recorder;
  }

  platformLabel(): string {
    return this.platform;
  }

  private send(command: WireClientMessage): void {
    this.recorder?.recordCommand(command);
    this.client?.send(command);
  }

  async setExpression(frame: ExpressionFrame): Promise<void> {
    this.send({ type: "setExpression", frame });
  }

  async playSequence(sequence: ExpressionSequence, loop?: boolean): Promise<void> {
    this.send({ type: "playSequence", sequence, loop });
  }

  pausePlayback(): void {
    this.send({ type: "pausePlayback" });
  }

  resumePlayback(): void {
    this.send({ type: "resumePlayback" });
  }

  seekPlayback(localTimeMs: number): void {
    this.send({ type: "seekPlayback", localTimeMs });
  }

  stopPlayback(): void {
    this.send({ type: "stopPlayback" });
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
