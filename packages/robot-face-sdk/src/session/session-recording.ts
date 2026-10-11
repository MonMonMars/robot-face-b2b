import type { ExpressionFrame } from "../expressions/frame.js";
import { parseFrame } from "../stream/wire-protocol.js";
import type { WireClientMessage } from "../stream/wire-protocol.js";

export const SESSION_RECORDING_VERSION = 1 as const;

export interface SessionRecordingFrameEvent {
  kind: "frame";
  atMs: number;
  frame: ExpressionFrame;
}

export interface SessionRecordingCommandEvent {
  kind: "command";
  atMs: number;
  command: WireClientMessage;
}

export type SessionRecordingEvent =
  | SessionRecordingFrameEvent
  | SessionRecordingCommandEvent;

export interface SessionRecording {
  version: typeof SESSION_RECORDING_VERSION;
  label: string;
  recordedAt: string;
  durationMs: number;
  events: SessionRecordingEvent[];
}

export class SessionRecorder {
  private startedAt = 0;
  private events: SessionRecordingEvent[] = [];
  private active = false;
  private label = "session";

  start(label = "session"): void {
    this.startedAt = Date.now();
    this.events = [];
    this.label = label;
    this.active = true;
  }

  stop(): SessionRecording {
    this.active = false;
    const durationMs =
      this.events.length > 0
        ? Math.max(...this.events.map((e) => e.atMs))
        : 0;
    return {
      version: SESSION_RECORDING_VERSION,
      label: this.label,
      recordedAt: new Date(this.startedAt).toISOString(),
      durationMs,
      events: [...this.events],
    };
  }

  isRecording(): boolean {
    return this.active;
  }

  recordFrame(frame: ExpressionFrame): void {
    if (!this.active) return;
    this.events.push({
      kind: "frame",
      atMs: Date.now() - this.startedAt,
      frame,
    });
  }

  recordCommand(command: WireClientMessage): void {
    if (!this.active) return;
    this.events.push({
      kind: "command",
      atMs: Date.now() - this.startedAt,
      command,
    });
  }

  exportJson(recording?: SessionRecording): string {
    const data = recording ?? this.stop();
    return `${JSON.stringify(data, null, 2)}\n`;
  }
}

export function parseSessionRecording(json: string): SessionRecording {
  const data: unknown = JSON.parse(json);
  if (!data || typeof data !== "object") {
    throw new Error("Recording must be an object");
  }
  const o = data as Record<string, unknown>;
  if (o.version !== SESSION_RECORDING_VERSION) {
    throw new Error(`Unsupported recording version: ${String(o.version)}`);
  }
  if (!Array.isArray(o.events)) {
    throw new Error("Recording events must be an array");
  }
  const events: SessionRecordingEvent[] = o.events.map((ev, i) => {
    if (!ev || typeof ev !== "object") {
      throw new Error(`events[${i}] invalid`);
    }
    const e = ev as Record<string, unknown>;
    if (typeof e.atMs !== "number") {
      throw new Error(`events[${i}].atMs required`);
    }
    if (e.kind === "frame") {
      return {
        kind: "frame",
        atMs: e.atMs,
        frame: parseFrame(e.frame),
      };
    }
    if (e.kind === "command") {
      const cmd = e.command as WireClientMessage;
      if (!cmd || typeof cmd !== "object" || !("type" in cmd)) {
        throw new Error(`events[${i}].command invalid`);
      }
      return { kind: "command", atMs: e.atMs, command: cmd };
    }
    throw new Error(`events[${i}].kind invalid`);
  });
  return {
    version: SESSION_RECORDING_VERSION,
    label: typeof o.label === "string" ? o.label : "session",
    recordedAt: typeof o.recordedAt === "string" ? o.recordedAt : "",
    durationMs: typeof o.durationMs === "number" ? o.durationMs : 0,
    events,
  };
}

export interface SessionReplayHandlers {
  onFrame: (frame: ExpressionFrame, atMs: number) => void;
  onCommand?: (command: WireClientMessage, atMs: number) => void;
  onComplete?: () => void;
}

export class SessionReplayer {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
    if (this.timer) clearTimeout(this.timer);
  }

  play(
    recording: SessionRecording,
    handlers: SessionReplayHandlers,
    options: { speed?: number } = {},
  ): Promise<void> {
    this.cancelled = false;
    const speed = options.speed ?? 1;
    let index = 0;

    return new Promise((resolve) => {
      const finish = (): void => {
        handlers.onComplete?.();
        resolve();
      };

      const step = (): void => {
        if (this.cancelled) {
          resolve();
          return;
        }
        if (index >= recording.events.length) {
          finish();
          return;
        }
        const ev = recording.events[index];
        index += 1;
        if (ev.kind === "frame") {
          handlers.onFrame(ev.frame, ev.atMs);
        } else {
          handlers.onCommand?.(ev.command, ev.atMs);
        }
        const next = recording.events[index];
        const delay = next ? (next.atMs - ev.atMs) / speed : 0;
        this.timer = setTimeout(step, Math.max(0, delay));
      };

      if (recording.events.length === 0) {
        finish();
        return;
      }
      step();
    });
  }
}
