import {
  BUILTIN_PRESETS,
  createExpressionFrame,
  createNeutralBlend,
  createSinglePrimitiveBlend,
  EXPRESSION_PRIMITIVES,
  getPresetById,
  normalizeBlend,
  parseSessionRecording,
  sequenceDurationMs,
  SessionRecorder,
  SessionReplayer,
  sortKeyframes,
  type BlendWeights,
  type ExpressionPrimitive,
  type RobotAdapterId,
  type StreamConnectionState,
} from "@robot-face/sdk";
import {
  adapterConnectOptions,
  defaultStreamUrl,
  LocalExpressionSession,
  StreamExpressionSession,
  type ConnectionMode,
  type ExpressionSession,
} from "./session.js";
import { FacePreviewCanvas } from "./face-preview.js";
import { TimelineEditor } from "./timeline-editor.js";

const faceCanvas = document.querySelector<HTMLCanvasElement>("#face-canvas")!;
const facePreview = new FacePreviewCanvas(faceCanvas, { showBars: true });
const dominantLabel = document.querySelector<HTMLElement>("#dominant-label")!;
const logEl = document.querySelector<HTMLElement>("#log")!;
const connModeSelect = document.querySelector<HTMLSelectElement>("#conn-mode")!;
const streamUrlInput = document.querySelector<HTMLInputElement>("#stream-url")!;
const streamTokenInput = document.querySelector<HTMLInputElement>("#stream-token")!;
const pausePlaybackBtn = document.querySelector<HTMLButtonElement>("#pause-playback")!;
const resumePlaybackBtn = document.querySelector<HTMLButtonElement>("#resume-playback")!;
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
const scrubInput = document.querySelector<HTMLInputElement>("#scrub")!;
const addKeyframeBtn = document.querySelector<HTMLButtonElement>("#add-keyframe")!;
const playTimelineBtn = document.querySelector<HTMLButtonElement>("#play-timeline")!;
const exportSeqBtn = document.querySelector<HTMLButtonElement>("#export-seq")!;
const importSeqInput = document.querySelector<HTMLInputElement>("#import-seq")!;
const keyframeListEl = document.querySelector<HTMLElement>("#keyframe-list")!;
const recordSessionBtn = document.querySelector<HTMLButtonElement>("#record-session")!;
const stopRecordSessionBtn = document.querySelector<HTMLButtonElement>("#stop-record-session")!;
const replaySessionInput = document.querySelector<HTMLInputElement>("#replay-session")!;
const recordStatusEl = document.querySelector<HTMLElement>("#record-status")!;

let session: ExpressionSession | null = null;
const sessionRecorder = new SessionRecorder();
const sessionReplayer = new SessionReplayer();
let timelineRaf = 0;
const sliderState: BlendWeights = createNeutralBlend(1).weights;

streamUrlInput.value = defaultStreamUrl();

const editor = new TimelineEditor({
  onSequenceChange: (seq) => {
    renderKeyframes();
    editor.renderMarkers(timelineMarkers, timelineProgress, timelineMeta);
    const dur = sequenceDurationMs(seq);
    scrubInput.max = String(Math.max(dur, 1));
  },
  onScrub: (_t, weights) => updateFacePreview(weights),
  onLog: (line) => appendLog(line),
});

editor.renderMarkers(timelineMarkers, timelineProgress, timelineMeta);

for (const preset of BUILTIN_PRESETS) {
  const opt = document.createElement("option");
  opt.value = preset.id;
  opt.textContent = preset.label;
  presetSelect.appendChild(opt);
}

for (const p of EXPRESSION_PRIMITIVES) {
  const row = document.createElement("label");
  row.className = "slider-row";
  const initial = p === "neutral" ? 100 : 0;
  row.innerHTML = `<span>${p}</span><input type="range" min="0" max="100" value="${initial}" data-primitive="${p}" /><output>${initial}</output>`;
  blendSlidersEl.appendChild(row);
  sliderState[p] = initial / 100;
  const input = row.querySelector("input")!;
  input.addEventListener("input", () => {
    sliderState[p] = Number(input.value) / 100;
    row.querySelector("output")!.textContent = input.value;
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

function updateFacePreview(weights: BlendWeights, intensity = 1): void {
  const dom = dominantPrimitive(weights);
  dominantLabel.textContent = dom;
  facePreview.render(weights, intensity);
  syncSliders(weights);
}

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

function connectionBadgeLabel(
  connected: boolean,
  platform: string,
  streamState?: StreamConnectionState,
): string {
  if (!connected && streamState && streamState !== "disconnected") {
    if (streamState === "connecting") return "Connecting to stream…";
    if (streamState === "reconnecting") return "Reconnecting to stream…";
  }
  return connected ? platform : "Disconnected";
}

function setConnectionBadge(
  connected: boolean,
  label: string,
  streamState?: StreamConnectionState,
): void {
  connBadge.textContent = connectionBadgeLabel(connected, label, streamState);
  if (!connected && streamState && streamState !== "disconnected") {
    connBadge.className = "badge badge--pending";
  } else {
    connBadge.className = connected ? "badge badge--on" : "badge badge--off";
  }
}

function setUiConnected(connected: boolean, label: string): void {
  setConnectionBadge(connected, label);
  connectBtn.textContent = connected ? "Disconnect" : "Connect";
  const en = connected;
  applyPresetBtn.disabled = !en;
  playPresetBtn.disabled = !en;
  applyBlendBtn.disabled = !en;
  stopPlaybackBtn.disabled = !en;
  pausePlaybackBtn.disabled = !en;
  resumePlaybackBtn.disabled = !en;
  addKeyframeBtn.disabled = !en;
  playTimelineBtn.disabled = !en;
  recordSessionBtn.disabled = !en;
  stopRecordSessionBtn.disabled = !en || !sessionRecorder.isRecording();
}

function createSession(mode: ConnectionMode): ExpressionSession {
  if (mode === "stream") {
    const token = streamTokenInput.value.trim();
    return new StreamExpressionSession(
      streamUrlInput.value.trim(),
      token || undefined,
    );
  }
  const adapterId = adapterSelect.value as RobotAdapterId;
  return new LocalExpressionSession(adapterId, adapterConnectOptions(adapterId));
}

function applyProgressUi(): void {
  const snap = session?.getRemoteProgress();
  if (!snap) return;
  playbackStateEl.textContent = snap.state;
  if (snap.durationMs > 0) {
    const pct = (snap.localTimeMs / snap.durationMs) * 100;
    timelineProgress.style.width = `${Math.min(100, pct)}%`;
    scrubInput.max = String(snap.durationMs);
    if (document.activeElement !== scrubInput) {
      scrubInput.value = String(Math.round(snap.localTimeMs));
    }
  }
}

function startProgressLoop(): void {
  cancelAnimationFrame(timelineRaf);
  const tick = (): void => {
    applyProgressUi();
    timelineRaf = requestAnimationFrame(tick);
  };
  tick();
}

function renderKeyframes(): void {
  keyframeListEl.innerHTML = "";
  const sorted = sortKeyframes(editor.sequence.keyframes);
  sorted.forEach((kf, index) => {
    const dom = dominantPrimitive(kf.blend.weights);
    const row = document.createElement("div");
    row.className = "keyframe-row";
    row.innerHTML = `
      <input type="number" data-k="atMs" value="${kf.atMs}" min="0" step="50" title="at ms" />
      <select data-k="primitive">${EXPRESSION_PRIMITIVES.map((p) => `<option value="${p}" ${p === dom ? "selected" : ""}>${p}</option>`).join("")}</select>
      <input type="number" data-k="intensity" value="${Math.round(kf.blend.intensity * 100)}" min="0" max="100" />
      <input type="number" data-k="holdMs" value="${kf.holdMs ?? 0}" min="0" step="50" title="hold ms" />
      <div class="kf-actions">
        <button type="button" data-act="up">↑</button>
        <button type="button" data-act="down">↓</button>
        <button type="button" data-act="del">×</button>
      </div>`;

    const bind = (): void => {
      const atMs = Number(row.querySelector<HTMLInputElement>('[data-k="atMs"]')!.value);
      const primitive = row.querySelector<HTMLSelectElement>('[data-k="primitive"]')!
        .value as ExpressionPrimitive;
      const intensity =
        Number(row.querySelector<HTMLInputElement>('[data-k="intensity"]')!.value) / 100;
      const holdMs = Number(row.querySelector<HTMLInputElement>('[data-k="holdMs"]')!.value);
      editor.updateKeyframe(index, {
        atMs,
        holdMs,
        blend: createSinglePrimitiveBlend(primitive, intensity),
      });
    };

    row.querySelectorAll("input,select").forEach((el) => {
      el.addEventListener("change", bind);
    });
    row.querySelector('[data-act="up"]')!.addEventListener("click", () => editor.moveKeyframe(index, -1));
    row.querySelector('[data-act="down"]')!.addEventListener("click", () => editor.moveKeyframe(index, 1));
    row.querySelector('[data-act="del"]')!.addEventListener("click", () => editor.removeKeyframe(index));

    keyframeListEl.appendChild(row);
  });
}

renderKeyframes();

connectBtn.addEventListener("click", async () => {
  if (session?.isConnected()) {
    session.stopPlayback();
    cancelAnimationFrame(timelineRaf);
    if (sessionRecorder.isRecording()) {
      sessionRecorder.stop();
      recordStatusEl.textContent = "Recording stopped (disconnect)";
    }
    await session.disconnect();
    session = null;
    setUiConnected(false, "Disconnected");
    appendLog("Disconnected");
    return;
  }

  session = createSession(connModeSelect.value as ConnectionMode);
  connectBtn.disabled = true;
  if (session.mode === "stream") {
    setConnectionBadge(false, "Stream", "connecting");
    session.onConnectionState((state) => {
      const label = `Stream · ${session?.platformLabel() ?? "…"}`;
      setConnectionBadge(session?.isConnected() ?? false, label, state);
      if (state === "reconnecting") appendLog("Stream reconnecting (backoff)…");
      if (state === "connected") appendLog("Stream connected");
    });
  }
  try {
    await session.connect();
  } catch (err) {
    appendLog(`Connect failed: ${err instanceof Error ? err.message : String(err)}`);
    session = null;
    setUiConnected(false, "Disconnected");
    connectBtn.disabled = false;
    return;
  }
  connectBtn.disabled = false;

  const label =
    session.mode === "stream"
      ? `Stream · ${session.platformLabel()}`
      : `Local · ${session.platformLabel()}`;
  setUiConnected(true, label);
  appendLog(`Connected (${session.mode})`);
  session.attachRecorder(sessionRecorder);

  session.onFrame((frame) =>
    updateFacePreview(frame.blend.weights, frame.blend.intensity),
  );
  session.onServerMessage((msg) => {
    if (msg.type === "error") appendLog(`Error: ${msg.message}`);
    if (msg.type === "playbackProgress") applyProgressUi();
    if (msg.type === "playbackState") playbackStateEl.textContent = msg.state;
  });

  startProgressLoop();
});

recordSessionBtn.addEventListener("click", () => {
  if (!session?.isConnected()) return;
  sessionRecorder.start(`studio-${new Date().toISOString().slice(0, 19)}`);
  recordStatusEl.textContent = "Recording…";
  stopRecordSessionBtn.disabled = false;
  appendLog("Session recording started");
});

stopRecordSessionBtn.addEventListener("click", () => {
  if (!sessionRecorder.isRecording()) return;
  const json = sessionRecorder.exportJson();
  recordStatusEl.textContent = "Not recording";
  stopRecordSessionBtn.disabled = true;
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `robot-face-session-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  appendLog("Session recording exported");
});

replaySessionInput.addEventListener("change", () => {
  const file = replaySessionInput.files?.[0];
  if (!file) return;
  void file.text().then(async (text) => {
    try {
      const recording = parseSessionRecording(text);
      sessionReplayer.cancel();
      appendLog(`Replaying session “${recording.label}” (${recording.events.length} events)`);
      await sessionReplayer.play(recording, {
        onFrame: (frame) => {
          updateFacePreview(frame.blend.weights, frame.blend.intensity);
          void session?.setExpression(frame);
        },
        onCommand: (command) => {
          if (command.type === "playSequence") {
            void session?.playSequence(command.sequence, command.loop);
          } else if (command.type === "pausePlayback") session?.pausePlayback();
          else if (command.type === "resumePlayback") session?.resumePlayback();
          else if (command.type === "seekPlayback") session?.seekPlayback(command.localTimeMs);
          else if (command.type === "stopPlayback") session?.stopPlayback();
        },
        onComplete: () => appendLog("Session replay finished"),
      });
    } catch (err) {
      appendLog(`Replay failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  replaySessionInput.value = "";
});

connModeSelect.addEventListener("change", () => {
  const stream = connModeSelect.value === "stream";
  streamUrlInput.parentElement!.style.display = stream ? "grid" : "none";
  streamTokenInput.parentElement!.style.display = stream ? "grid" : "none";
  adapterSelect.parentElement!.style.display = stream ? "none" : "grid";
});

connModeSelect.dispatchEvent(new Event("change"));

presetSelect.addEventListener("change", () => {
  presetDesc.textContent = getPresetById(presetSelect.value)?.description ?? "";
});
presetSelect.dispatchEvent(new Event("change"));

applyPresetBtn.addEventListener("click", () => {
  void (async () => {
    if (!session?.isConnected()) return;
    const preset = getPresetById(presetSelect.value);
    if (!preset?.blend) return appendLog("No static blend on preset");
    await session.setExpression(
      createExpressionFrame(preset.blend, { durationMs: Number(durationInput.value) }),
    );
    appendLog(`Applied preset ${preset.id}`);
  })();
});

playPresetBtn.addEventListener("click", () => {
  void (async () => {
    if (!session?.isConnected()) return;
    const preset = getPresetById(presetSelect.value);
    if (!preset?.sequence) return appendLog("No sequence on preset");
    if (preset.sequence) {
      editor.sequence = { ...preset.sequence };
      editor.renderMarkers(timelineMarkers, timelineProgress, timelineMeta);
      renderKeyframes();
    }
    await session.playSequence(
      preset.sequence,
      loopCheckbox.checked || preset.sequence.loop,
    );
    startProgressLoop();
    appendLog(`Playing ${preset.sequence.name}`);
  })();
});

stopPlaybackBtn.addEventListener("click", () => {
  session?.stopPlayback();
  appendLog("Playback stopped");
});

pausePlaybackBtn.addEventListener("click", () => {
  session?.pausePlayback();
  appendLog("Playback paused");
});

resumePlaybackBtn.addEventListener("click", () => {
  session?.resumePlayback();
  appendLog("Playback resumed");
});

applyBlendBtn.addEventListener("click", () => {
  void (async () => {
    if (!session?.isConnected()) return;
    const blend = normalizeBlend({ weights: { ...sliderState }, intensity: 1 });
    await session.setExpression(
      createExpressionFrame(blend, { durationMs: Number(durationInput.value) }),
    );
    appendLog("Sent custom blend");
  })();
});

addKeyframeBtn.addEventListener("click", () => {
  const dom = dominantPrimitive(sliderState);
  const dur = sequenceDurationMs(editor.sequence);
  editor.addKeyframe(dom, sliderState[dom] || 1, dur + 200);
  appendLog("Added keyframe");
});

playTimelineBtn.addEventListener("click", () => {
  void (async () => {
    if (!session?.isConnected()) return;
    await session.playSequence(editor.sequence, editor.sequence.loop || loopCheckbox.checked);
    startProgressLoop();
    appendLog("Playing custom timeline");
  })();
});

scrubInput.addEventListener("input", () => {
  const t = Number(scrubInput.value);
  editor.scrub(t);
  session?.seekPlayback(t);
  const pct = (t / Math.max(Number(scrubInput.max), 1)) * 100;
  timelineProgress.style.width = `${pct}%`;
});

exportSeqBtn.addEventListener("click", () => {
  const blob = new Blob([editor.exportJson()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${editor.sequence.id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

importSeqInput.addEventListener("change", () => {
  const file = importSeqInput.files?.[0];
  if (!file) return;
  void file.text().then((text) => editor.importJson(text));
  importSeqInput.value = "";
});

updateFacePreview(sliderState);
