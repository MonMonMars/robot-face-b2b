import type { ExpressionFrame } from "../expressions/frame.js";
import type { RobotConnectionOptions } from "./types.js";

export interface VendorStubState {
  address: string;
  dryRun: boolean;
  sentFrames: ExpressionFrame[];
  log: string[];
}

export function readStubOptions(options?: RobotConnectionOptions): {
  address: string;
  dryRun: boolean;
  extras: Record<string, string>;
} {
  if (!options?.address) {
    throw new Error("address is required");
  }
  const dryRun = options.credentials?.dryRun === "true";
  const extras = { ...(options.credentials ?? {}) };
  delete extras.dryRun;
  return { address: options.address, dryRun, extras };
}

export function logDryRunFrame(
  state: VendorStubState,
  vendor: string,
  frame: ExpressionFrame,
): void {
  state.sentFrames.push(frame);
  const line = `${vendor}:dry-run frame @ ${frame.timestampMs} seq=${frame.sequenceId ?? "—"}`;
  state.log.push(line);
}
