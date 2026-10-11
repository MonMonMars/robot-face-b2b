import type { WireServerMessage } from "./wire-protocol.js";

export interface StreamPresenceClient {
  id: string;
  label?: string;
}

export interface StreamPresenceSnapshot {
  clientCount: number;
  clients: StreamPresenceClient[];
}

export class StreamPresenceTracker {
  private readonly clients = new Map<string, { label?: string }>();

  register(clientId: string, label?: string): StreamPresenceSnapshot {
    this.clients.set(clientId, { label });
    return this.snapshot();
  }

  unregister(clientId: string): StreamPresenceSnapshot {
    this.clients.delete(clientId);
    return this.snapshot();
  }

  setLabel(clientId: string, label?: string): StreamPresenceSnapshot {
    const entry = this.clients.get(clientId);
    if (!entry) {
      this.clients.set(clientId, { label });
    } else {
      entry.label = label;
    }
    return this.snapshot();
  }

  snapshot(): StreamPresenceSnapshot {
    const clients: StreamPresenceClient[] = [...this.clients.entries()].map(
      ([id, meta]) => ({ id, label: meta.label }),
    );
    return { clientCount: clients.length, clients };
  }

  toPresenceMessage(snapshot?: StreamPresenceSnapshot): WireServerMessage {
    const s = snapshot ?? this.snapshot();
    return {
      type: "presence",
      clientCount: s.clientCount,
      clients: s.clients,
    };
  }
}

export function createStreamClientId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
