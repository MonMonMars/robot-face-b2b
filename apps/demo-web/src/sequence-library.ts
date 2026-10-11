import type { ExpressionSequence } from "@robot-face/sdk";

export interface SequenceLibraryEntry {
  id: string;
  name: string;
  updatedAt: string;
}

export function streamHttpBase(streamWsUrl: string): string {
  const normalized = streamWsUrl.trim().replace(/^ws/i, "http").replace(/^wss/i, "https");
  const url = new URL(normalized);
  return `${url.protocol}//${url.host}`;
}

function authHeaders(token?: string): HeadersInit {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function listStoredSequences(
  httpBase: string,
  token?: string,
): Promise<SequenceLibraryEntry[]> {
  const res = await fetch(`${httpBase}/sequences`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`List failed (${res.status})`);
  const body = (await res.json()) as { sequences: SequenceLibraryEntry[] };
  return body.sequences ?? [];
}

export async function loadStoredSequence(
  httpBase: string,
  id: string,
  token?: string,
): Promise<ExpressionSequence> {
  const res = await fetch(`${httpBase}/sequences/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Load failed (${res.status})`);
  const body = (await res.json()) as { sequence: ExpressionSequence };
  return body.sequence;
}

export async function saveStoredSequence(
  httpBase: string,
  id: string,
  sequence: ExpressionSequence,
  token?: string,
): Promise<SequenceLibraryEntry> {
  const res = await fetch(`${httpBase}/sequences/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(sequence),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Save failed (${res.status})`);
  }
  const body = (await res.json()) as { entry: SequenceLibraryEntry };
  return body.entry;
}
