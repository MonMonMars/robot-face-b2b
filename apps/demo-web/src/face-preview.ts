import {
  EXPRESSION_PRIMITIVES,
  type BlendWeights,
  type ExpressionPrimitive,
} from "@robot-face/sdk";

export interface FacePreviewOptions {
  /** Weight bars under canvas */
  showBars?: boolean;
}

/**
 * Realtime canvas visualization driven by blend weights (no hardware required).
 */
export class FacePreviewCanvas {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly barHeight = 6;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: FacePreviewOptions = {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not available");
    this.ctx = ctx;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 220);
    const h = Math.max(rect.height, 240);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(weights: BlendWeights, intensity = 1): void {
    const w = this.canvas.clientWidth || 220;
    const h = this.canvas.clientHeight || 240;
    const cx = w / 2;
    const cy = h / 2 - 8;
    const radius = Math.min(w, h) * 0.36;

    const mood = blendMood(weights, intensity);

    this.ctx.clearRect(0, 0, w, h);

    // Face base
    const grad = this.ctx.createRadialGradient(cx, cy - 10, radius * 0.2, cx, cy, radius);
    grad.addColorStop(0, "#2a3548");
    grad.addColorStop(1, "#151d2a");
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = mood.accent;
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Eyes
    const eyeY = cy - radius * 0.12;
    const eyeSep = radius * 0.38;
    const eyeH = radius * (0.12 + mood.eyeOpen * 0.14);
    const eyeW = radius * 0.14;
    for (const sign of [-1, 1]) {
      this.ctx.fillStyle = mood.eyeColor;
      this.ctx.beginPath();
      this.ctx.ellipse(cx + sign * eyeSep, eyeY, eyeW, eyeH, sign * mood.eyeTilt, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Mouth
    this.ctx.strokeStyle = mood.mouthColor;
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    const mouthY = cy + radius * 0.35;
    const mouthW = radius * 0.45;
    if (mood.mouthOpen > 0.55) {
      this.ctx.arc(cx, mouthY - radius * 0.05, radius * 0.12 * mood.mouthOpen, 0, Math.PI * 2);
      this.ctx.fillStyle = mood.mouthColor;
      this.ctx.fill();
    } else {
      this.ctx.moveTo(cx - mouthW, mouthY);
      this.ctx.quadraticCurveTo(cx, mouthY + mood.smile * radius * 0.35, cx + mouthW, mouthY);
      this.ctx.stroke();
    }

    if (this.options.showBars !== false) {
      this.drawWeightBars(weights, w, h);
    }
  }

  private drawWeightBars(weights: BlendWeights, w: number, h: number): void {
    const barW = w - 24;
    const left = 12;
    let y = h - EXPRESSION_PRIMITIVES.length * (this.barHeight + 4) - 8;
    const colors: Record<ExpressionPrimitive, string> = {
      neutral: "#8b9cb3",
      happiness: "#5fd48a",
      surprise: "#f0c14d",
      anger: "#f07167",
      sadness: "#7b8cff",
    };
    for (const p of EXPRESSION_PRIMITIVES) {
      this.ctx.fillStyle = "#1a2433";
      this.ctx.fillRect(left, y, barW, this.barHeight);
      this.ctx.fillStyle = colors[p];
      this.ctx.fillRect(left, y, barW * weights[p], this.barHeight);
      this.ctx.fillStyle = "#8b9cb3";
      this.ctx.font = "10px system-ui,sans-serif";
      this.ctx.fillText(p.slice(0, 4), left, y - 2);
      y += this.barHeight + 4;
    }
  }
}

function blendMood(weights: BlendWeights, intensity: number) {
  const w = weights;
  const t = intensity;
  const smile = (w.happiness - w.sadness - w.anger * 0.5) * t;
  const eyeOpen = (0.35 + w.surprise * 0.65 - w.anger * 0.25) * t;
  const mouthOpen = w.surprise * 0.9 * t;
  const anger = w.anger * t;
  const happy = w.happiness * t;

  let accent = "#4dabf7";
  if (happy > 0.4) accent = "#5fd48a";
  if (w.surprise > 0.4) accent = "#f0c14d";
  if (anger > 0.4) accent = "#f07167";
  if (w.sadness > 0.4) accent = "#7b8cff";

  return {
    smile,
    eyeOpen: Math.min(1, Math.max(0.15, eyeOpen)),
    eyeTilt: anger > 0.3 ? 0.35 : 0,
    mouthOpen,
    accent,
    eyeColor: accent,
    mouthColor: accent,
  };
}
