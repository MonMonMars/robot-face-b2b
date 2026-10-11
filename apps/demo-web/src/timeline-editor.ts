import {
  createSinglePrimitiveBlend,
  exportSequenceJson,
  ExpressionPlayback,
  importSequenceJson,
  sequenceDurationMs,
  sortKeyframes,
  type ExpressionKeyframe,
  type ExpressionPrimitive,
  type ExpressionSequence,
} from "@robot-face/sdk";

export interface TimelineEditorCallbacks {
  onSequenceChange: (seq: ExpressionSequence) => void;
  onScrub: (localTimeMs: number, weights: import("@robot-face/sdk").BlendWeights) => void;
  onLog: (line: string) => void;
}

export class TimelineEditor {
  sequence: ExpressionSequence = {
    id: "custom-seq",
    name: "Custom sequence",
    loop: false,
    keyframes: [
      { atMs: 0, blend: createSinglePrimitiveBlend("neutral", 1), holdMs: 200 },
    ],
  };

  private readonly playback = new ExpressionPlayback();

  constructor(private readonly callbacks: TimelineEditorCallbacks) {}

  renderMarkers(container: HTMLElement, progressEl: HTMLElement, metaEl: HTMLElement): void {
    container.innerHTML = "";
    const duration = Math.max(sequenceDurationMs(this.sequence), 1);
    for (const kf of sortKeyframes(this.sequence.keyframes)) {
      const m = document.createElement("span");
      m.className = "marker";
      m.style.left = `${(kf.atMs / duration) * 100}%`;
      m.title = `@ ${kf.atMs}ms`;
      container.appendChild(m);
    }
    metaEl.textContent = `${this.sequence.name} · ${duration}ms · ${this.sequence.keyframes.length} keys`;
    progressEl.style.width = "0%";
  }

  addKeyframe(primitive: ExpressionPrimitive, intensity: number, atMs: number): void {
    this.sequence.keyframes.push({
      atMs,
      blend: createSinglePrimitiveBlend(primitive, intensity),
      holdMs: 150,
      easing: "ease-in-out",
    });
    this.sequence.keyframes = sortKeyframes(this.sequence.keyframes);
    this.callbacks.onSequenceChange(this.sequence);
  }

  updateKeyframe(index: number, patch: Partial<ExpressionKeyframe>): void {
    const sorted = sortKeyframes(this.sequence.keyframes);
    if (index < 0 || index >= sorted.length) return;
    sorted[index] = { ...sorted[index], ...patch };
    this.sequence.keyframes = sortKeyframes(sorted);
    this.callbacks.onSequenceChange(this.sequence);
  }

  removeKeyframe(index: number): void {
    const sorted = sortKeyframes(this.sequence.keyframes);
    sorted.splice(index, 1);
    this.sequence.keyframes = sorted.length ? sorted : this.sequence.keyframes;
    this.callbacks.onSequenceChange(this.sequence);
  }

  moveKeyframe(index: number, direction: -1 | 1): void {
    const sorted = sortKeyframes(this.sequence.keyframes);
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const tmp = sorted[index].atMs;
    sorted[index].atMs = sorted[target].atMs;
    sorted[target].atMs = tmp;
    this.sequence.keyframes = sortKeyframes(sorted);
    this.callbacks.onSequenceChange(this.sequence);
  }

  scrub(localTimeMs: number): void {
    const weights = this.playback.sampleAt(this.sequence, localTimeMs).weights;
    this.callbacks.onScrub(localTimeMs, weights);
  }

  exportJson(): string {
    return exportSequenceJson(this.sequence);
  }

  importJson(raw: string): void {
    this.sequence = importSequenceJson(raw);
    this.callbacks.onSequenceChange(this.sequence);
    this.callbacks.onLog("Imported sequence JSON");
  }

  setLoop(loop: boolean): void {
    this.sequence.loop = loop;
    this.callbacks.onSequenceChange(this.sequence);
  }
}
