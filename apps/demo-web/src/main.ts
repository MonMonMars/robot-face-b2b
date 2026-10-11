import {
  BUILTIN_PRESETS,
  configToConnectionOptions,
  createExpressionFrame,
  createNeutralBlend,
  createRobotAdapter,
  ExpressionPlayback,
  EXPRESSION_PRIMITIVES,
  getPresetById,
  normalizeBlend,
  parseAdapterConfig,
  sequenceDurationMs,
  type BlendWeights,
  type ExpressionPrimitive,
  type ExpressionSequence,
  type RobotAdapter,
  type RobotAdapterId,
} from "@robot-face/sdk";

const faceEl = document.querySelector<HTMLElement>("#face")!;
const dominantLabel = document.querySelector<HTMLElement>("#dominant-label")!;
const logEl = document.querySelector<HTMLElement>("#log")!;
const adapterSelect = document.querySelector<HTMLSelectElement>("#adapter-id")!;
const connBadge = document.querySelector<HTMLElement>("#conn-badge")!;
const connectBtn = document.querySelector<HTMLButtonElement>("#connect")!;
const presetSelect = document.querySelector<HTMLSelectElement>("#preset")!;
const presetDesc = document.querySelector<HTMLElement>("#preset-desc")!;
const applyPresetBtn = document.querySelector<HTMLButtonElement>("#apply-preset")!;
const playPresetBtn = document.querySelector<HTMLButtonElement>("#play-preset")!;
const stopPlaybackBtn = document.querySelector<HTMLButtonElement>("#stop-playback")!;
const loopCheckbox = document.querySelector<HTMLInputElement>("#loop-playback")!;
const durationInput = document.querySelector<HTMLInputElement>("#duration")!;
const applyBlendBtn = document.querySelector<HTMLButtonElement>("#apply-blend")!;
const blendSlidersEl = document.querySelector<HTMLElement>("#blend-sliders")!;
const timelineProgress = document.querySelector<HTMLElement>("#timeline-progress")!;
const timelineMarkers = document.querySelector<HTMLElement>("#timeline-markers")!;
const timelineMeta = document.querySelector<HTMLElement>("#timeline-meta")!;
const playbackStateEl = document.querySelector<HTMLElement>("#playback-state")!;

let robot: RobotAdapter | null = null;
const playback = new ExpressionPlayback();
let timelineRaf = 0;
let activeSequence: ExpressionSequence | null = null;

const sliderState: BlendWeights = createNeutralBlend(1).weights;

for (const preset of BUILTIN_PRESETS) {
  const opt = document.createElement("option");
  opt.value = preset.id;
  opt.textContent = preset.label;
  presetSelect.appendChild(opt);
}

for (const p of EXPRESSION_PRIMITIVES) {
  const row = document.createElement("label");
  row.className = "slider-row";
  row.innerHTML = `<span>${p}</span><input type="range" min="0" max="100" value="${p === "neutral" ? 100 : 0}" data-primitive="${p}" /><output>0</output>`;
  blendSlidersEl.appendChild(row);
  const input = row.querySelector("input")!;
  input.addEventListener("input", () => {
    sliderState[p] = Number(input.value) / 100;
    const out = row.querySelector("output")!;
    out.textContent = input.value;
    updateFacePreview(sliderState);
  });
}

function appendLog(line: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  logEl.textContent = `[${ts}] ${line}\n${logEl.textContent ?? ""}`.trim();
}

function dominantPrimitive(weights: BlendWeights): ExpressionPrimitive {
  let best: ExpressionPrimitive = "neutral";
  let bestW = -1;
  for (const p of EXPRESSION_PRIMITIVES) {
    if (weights[p] > bestW) {
      bestW = weights[p];
      best = p;
    }
  }
  return best;
}

function updateFacePreview(weights: BlendWeights): void {
  faceEl.className = "face";
  const dom = dominantPrimitive(weights);
  faceEl.classList.add(`face--${dom}`);
  dominantLabel.textContent = dom;
}

function setConnectionUi(connected: boolean, label: string): void {
  connBadge.textContent = label;
  connBadge.className = connected ? "badge badge--on" : "badge badge--off";
  connectBtn.textContent = connected ? "Disconnect" : "Connect";
  applyPresetBtn.disabled = !connected;
  playPresetBtn.disabled = !connected;
  applyBlendBtn.disabled = !connected;
  stopPlaybackBtn.disabled = !connected;
}

function adapterConnectionOptions(id: RobotAdapterId) {
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

function renderTimelineMarkers(sequence: ExpressionSequence): void {
  timelineMarkers.innerHTML = "";
  const duration = Math.max(sequenceDurationMs(sequence), 1);
  for (const kf of sequence.keyframes) {
    const m = document.createElement("span");
    m.className = "marker";
    m.style.left = `${(kf.atMs / duration) * 100}%`;
    m.title = `@ ${kf.atMs}ms`;
    timelineMarkers.appendChild(m);
  }
  timelineMeta.textContent = `${sequence.name} · ${duration}ms · ${sequence.loop ? "loop" : "once"}`;
}

function startTimelineUi(sequence: ExpressionSequence): void {
  activeSequence = sequence;
  renderTimelineMarkers(sequence);
  cancelAnimationFrame(timelineRaf);
  const tick = (): void => {
    const prog = playback.getProgress();
    playbackStateEl.textContent = playback.getState();
    if (prog && activeSequence) {
      const pct = (prog.localTimeMs / Math.max(prog.durationMs, 1)) * 100;
      timelineProgress.style.width = `${Math.min(100, pct)}%`;
    }
    timelineRaf = requestAnimationFrame(tick);
  };
  tick();
}

connectBtn.addEventListener("click", async () => {
  if (robot?.isConnected()) {
    playback.stop();
    cancelAnimationFrame(timelineRaf);
    await robot.disconnect();
    robot = null;
    setConnectionUi(false, "Disconnected");
    appendLog("Disconnected");
    playbackStateEl.textContent = "idle";
    return;
  }

  const adapterId = adapterSelect.value as RobotAdapterId;
  robot = createRobotAdapter(adapterId);
  await robot.connect(adapterConnectionOptions(adapterId));
  const cap = robot.capabilities.platformLabel;
  setConnectionUi(true, `Connected · ${cap}`);
  appendLog(`Connected (${adapterId})`);

  robot.expressionStream.subscribe((frame) => {
    updateFacePreview(frame.blend.weights);
    syncSliders(frame.blend.weights);
  });
});

function syncSliders(weights: BlendWeights): void {
  for (const p of EXPRESSION_PRIMITIVES) {
    const input = blendSlidersEl.querySelector<HTMLInputElement>(
      `input[data-primitive="${p}"]`,
    )!;
    const val = Math.round(weights[p] * 100);
    input.value = String(val);
    input.parentElement!.querySelector("output")!.textContent = String(val);
    sliderState[p] = weights[p];
  }
}

presetSelect.addEventListener("change", () => {
  const preset = getPresetById(presetSelect.value);
  presetDesc.textContent = preset?.description ?? "";
});

presetSelect.dispatchEvent(new Event("change"));

applyPresetBtn.addEventListener("click", () => {
  void (async () => {
    if (!robot?.isConnected()) return;
    const preset = getPresetById(presetSelect.value);
    if (!preset?.blend) {
      appendLog("Preset has no static blend — use Play sequence");
      return;
    }
    const frame = createExpressionFrame(preset.blend, {
      durationMs: Number(durationInput.value),
    });
    await robot.setExpression(frame);
    appendLog(`Applied preset ${preset.id}`);
  })();
});

playPresetBtn.addEventListener("click", () => {
  void (async () => {
    if (!robot?.isConnected()) return;
    const preset = getPresetById(presetSelect.value);
    if (!preset?.sequence) {
      appendLog("Preset has no sequence — use Apply pose");
      return;
    }
    playback.stop();
    startTimelineUi(preset.sequence);
    await playback.playSequence(preset.sequence, robot, {
      loop: loopCheckbox.checked || preset.sequence.loop,
    });
    appendLog(`Playing ${preset.sequence.name}`);
  })();
});

stopPlaybackBtn.addEventListener("click", () => {
  playback.stop();
  playbackStateEl.textContent = playback.getState();
  appendLog("Playback stopped");
});

applyBlendBtn.addEventListener("click", () => {
  void (async () => {
    if (!robot?.isConnected()) return;
    const blend = normalizeBlend({
      weights: { ...sliderState },
      intensity: 1,
    });
    await robot.setExpression(
      createExpressionFrame(blend, { durationMs: Number(durationInput.value) }),
    );
    appendLog("Sent custom blend");
  })();
});

updateFacePreview(sliderState);
