import { describe, expect, it } from "vitest";
import { StreamPresenceTracker } from "./stream-presence.js";

describe("StreamPresenceTracker", () => {
  it("tracks register and unregister", () => {
    const tracker = new StreamPresenceTracker();
    tracker.register("a", "cli");
    tracker.register("b");
    expect(tracker.snapshot().clientCount).toBe(2);
    tracker.unregister("a");
    expect(tracker.snapshot().clientCount).toBe(1);
    expect(tracker.snapshot().clients[0]?.id).toBe("b");
  });

  it("updates labels and builds presence message", () => {
    const tracker = new StreamPresenceTracker();
    tracker.register("x");
    tracker.setLabel("x", "studio");
    const msg = tracker.toPresenceMessage();
    expect(msg.type).toBe("presence");
    if (msg.type === "presence") {
      expect(msg.clientCount).toBe(1);
      expect(msg.clients[0]?.label).toBe("studio");
    }
  });
});
