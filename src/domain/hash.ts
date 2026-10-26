import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json";
import type { JsonValue } from "./types";

export const GENESIS_PREV_HASH = "0".repeat(64);

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export type LedgerHashInput = {
  seq: number;
  prevHash: string;
  ts: string;
  actorId: string | null;
  eventType: string;
  payload: JsonValue;
};

// Spec §5: sha256_hex(canonicalJson({seq, prevHash, ts, actorId, eventType, payload})).
export function entryHash(e: LedgerHashInput): string {
  return sha256Hex(
    canonicalJson({
      seq: e.seq,
      prevHash: e.prevHash,
      ts: e.ts,
      actorId: e.actorId,
      eventType: e.eventType,
      payload: e.payload,
    }),
  );
}
