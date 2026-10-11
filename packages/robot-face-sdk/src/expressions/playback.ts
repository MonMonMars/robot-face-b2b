import { createExpressionFrame, type ExpressionFrame } from "./frame.js";
import { normalizeBlend, type BlendWeights } from "./blend.js";
import type { ExpressionSequence } from "./keyframes.js";
import { sequenceDurationMs, sortKeyframes } from "./keyframes.js";
import { ease, lerpBlend } from "./transitions.js";
import type { RobotAdapter } from "../adapters/types.js";

export type PlaybackState = "idle" | "playing" | "paused" | "stopped";

export interface PlaybackProgressSnapshot {
  state: PlaybackState;
  sequenceId?: string;
  sequenceName?: string;
  localTimeMs: number;
  durationMs: number;
  loop: boolean;
  loopIndex: number;
}

export interface PlaybackOptions {
  loop?: boolean;
  /** Called for each emitted frame (before adapter). */
  onFrame?: (frame: ExpressionFrame, context: PlaybackTickContext) => void;
  onProgress?: (progress: PlaybackProgressSnapshot) => void;
}

export interface PlaybackTickContext {
  sequenceId: string;
  localTimeMs: number;
  loopIndex: number;
}

export class ExpressionPlayback {
  private state: PlaybackState = "idle";
  private sequence: ExpressionSequence | undefined;
  private startedAt = 0;
  private pausedAt = 0;
  private pauseOffset = 0;
  private loopIndex = 0;
  private raf: ReturnType<typeof setInterval> | undefined;
  private options: PlaybackOptions = {};
  private adapter: RobotAdapter | undefined;

  /** Sample blend at local time within one loop iteration. */
  sampleAt(sequence: ExpressionSequence, localTimeMs: number) {
    const keyframes = sortKeyframes(sequence.keyframes);
    if (keyframes.length === 0) {
      return normalizeBlend({ weights: createEmpty(), intensity: 0 });
    }
    if (localTimeMs <= keyframes[0].atMs) {
      return normalizeBlend(keyframes[0].blend);
    }

    for (let i = 1; i < keyframes.length; i++) {
      const prev = keyframes[i - 1];
      const next = keyframes[i];
      const segmentStart = prev.atMs + (prev.holdMs ?? 0);
      if (localTimeMs < segmentStart) {
        return normalizeBlend(prev.blend);
      }
      if (localTimeMs <= next.atMs) {
        const span = next.atMs - segmentStart;
        const rawT = span <= 0 ? 1 : (localTimeMs - segmentStart) / span;
        const t = ease(rawT, next.easing ?? "ease-in-out");
        return normalizeBlend(lerpBlend(prev.blend, next.blend, t));
      }
    }

    const last = keyframes[keyframes.length - 1];
    const end = last.atMs + (last.holdMs ?? 0);
    if (localTimeMs <= end) {
      return normalizeBlend(last.blend);
    }
    return normalizeBlend(last.blend);
  }

  async playSequence(
    sequence: ExpressionSequence,
    adapter: RobotAdapter,
    options: PlaybackOptions = {},
  ): Promise<void> {
    this.stopInternal("idle");
    this.sequence = sequence;
    this.adapter = adapter;
    this.options = options;
    this.loopIndex = 0;
    this.state = "playing";
    this.startedAt = Date.now();
    this.pauseOffset = 0;
    this.emitProgress();

    const tickMs = 1000 / (adapter.capabilities.maxStreamHz ?? 30);
    this.raf = setInterval(() => {
      void this.tick();
    }, tickMs);

    await this.tick();
  }

  pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.pausedAt = Date.now();
    if (this.raf) clearInterval(this.raf);
    this.raf = undefined;
    this.emitProgress();
  }

  resume(): void {
    if (this.state !== "paused" || !this.sequence || !this.adapter) return;
    this.pauseOffset += Date.now() - this.pausedAt;
    this.state = "playing";
    const tickMs = 1000 / (this.adapter.capabilities.maxStreamHz ?? 30);
    this.raf = setInterval(() => {
      void this.tick();
    }, tickMs);
    this.emitProgress();
  }

  seek(localTimeMs: number): void {
    if (!this.sequence) return;
    const durationMs = sequenceDurationMs(this.sequence);
    const loop = this.options.loop ?? this.sequence.loop ?? false;

    if (loop && durationMs > 0) {
      const clamped = Math.max(0, localTimeMs);
      this.loopIndex = Math.floor(clamped / durationMs);
      const inLoop = clamped % durationMs;
      this.startedAt = Date.now() - inLoop - this.pauseOffset;
    } else {
      const t = Math.min(Math.max(0, localTimeMs), durationMs);
      this.startedAt = Date.now() - t - this.pauseOffset;
      this.loopIndex = 0;
    }
    this.emitProgress();
  }

  stop(): void {
    this.stopInternal("stopped");
    this.emitProgress();
  }

  getState(): PlaybackState {
    return this.state;
  }

  getActiveSequence(): ExpressionSequence | undefined {
    return this.sequence;
  }

  getProgress(): { localTimeMs: number; durationMs: number; loop: boolean } | null {
    const snap = this.getSnapshot();
    if (!snap) return null;
    return {
      localTimeMs: snap.localTimeMs,
      durationMs: snap.durationMs,
      loop: snap.loop,
    };
  }

  getSnapshot(): PlaybackProgressSnapshot | null {
    if (!this.sequence) {
      return {
        state: this.state,
        localTimeMs: 0,
        durationMs: 0,
        loop: false,
        loopIndex: 0,
      };
    }
    const durationMs = sequenceDurationMs(this.sequence);
    const localTimeMs =
      this.state === "idle" && durationMs === 0
        ? 0
        : this.computeLocalTime(durationMs);
    return {
      state: this.state,
      sequenceId: this.sequence.id,
      sequenceName: this.sequence.name,
      localTimeMs,
      durationMs,
      loop: this.options.loop ?? this.sequence.loop ?? false,
      loopIndex: this.loopIndex,
    };
  }

  private stopInternal(state: PlaybackState): void {
    if (this.raf) clearInterval(this.raf);
    this.raf = undefined;
    this.state = state;
    this.sequence = undefined;
    this.adapter = undefined;
    this.options = {};
    this.loopIndex = 0;
    this.pauseOffset = 0;
  }

  private computeLocalTime(durationMs: number): number {
    if (this.state === "paused") {
      return Math.min(
        Math.max(0, this.pausedAt - this.startedAt - this.pauseOffset),
        durationMs || Number.MAX_SAFE_INTEGER,
      );
    }
    const elapsed = Date.now() - this.startedAt - this.pauseOffset;
    if (durationMs <= 0) return 0;
    const loop = this.options.loop ?? this.sequence?.loop ?? false;
    if (!loop) return Math.min(elapsed, durationMs);
    this.loopIndex = Math.floor(elapsed / durationMs);
    return elapsed % durationMs;
  }

  private emitProgress(): void {
    const snap = this.getSnapshot();
    if (snap) this.options.onProgress?.(snap);
  }

  private async tick(): Promise<void> {
    if (this.state !== "playing" || !this.sequence || !this.adapter) return;

    const durationMs = sequenceDurationMs(this.sequence);
    const localTimeMs = this.computeLocalTime(durationMs);
    const loop = this.options.loop ?? this.sequence.loop ?? false;

    this.emitProgress();

    if (!loop && localTimeMs >= durationMs && durationMs > 0) {
      this.stopInternal("idle");
      this.emitProgress();
      return;
    }

    const blend = this.sampleAt(this.sequence, localTimeMs);
    const frame = createExpressionFrame(blend, {
      durationMs: Math.ceil(1000 / (this.adapter.capabilities.maxStreamHz ?? 30)),
      sequenceId: `${this.sequence.id}:${this.loopIndex}`,
    });

    this.options.onFrame?.(frame, {
      sequenceId: this.sequence.id,
      localTimeMs,
      loopIndex: this.loopIndex,
    });

    await this.adapter.setExpression(frame);
  }
}

function createEmpty(): BlendWeights {
  return {
    neutral: 0,
    happiness: 0,
    surprise: 0,
    anger: 0,
    sadness: 0,
  };
}
