import type { ExpressionSequence } from "../expressions/keyframes.js";
import { sortKeyframes } from "../expressions/keyframes.js";
import { parseSequence } from "./wire-protocol.js";

export function exportSequenceJson(sequence: ExpressionSequence): string {
  const normalized: ExpressionSequence = {
    ...sequence,
    keyframes: sortKeyframes(sequence.keyframes),
  };
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function importSequenceJson(json: string): ExpressionSequence {
  const data: unknown = JSON.parse(json);
  return parseSequence(data);
}
