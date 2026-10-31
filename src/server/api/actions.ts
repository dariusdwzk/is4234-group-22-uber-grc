import "server-only";
import type { Actor } from "@/domain/types";
import { acknowledgeNotice } from "../commands/acknowledge-notice";
import { addEvidence } from "../commands/add-evidence";
import { attachContact } from "../commands/attach-contact";
import { attemptAction } from "../commands/attempt-action";
import { confirmTriage } from "../commands/confirm-triage";
import { disclose } from "../commands/disclose";
import { checkReceipt, reportIncident } from "../commands/employee";
import { recommend } from "../commands/recommend";
import { recordFinding } from "../commands/record-finding";
import { resetDemo } from "../commands/reset-demo";
import { castVote } from "../commands/vote";
import { Conflict, Forbidden, NotFound, ValidationError } from "../errors";

type Handler = (actor: Actor | null, body: unknown) => Promise<unknown>;

/** POST /api/actions/<name>. Every handler checks the role itself, on the server. */
export const ACTIONS: Record<string, Handler> = {
  finding: recordFinding,
  evidence: addEvidence,
  attach: attachContact,
  recommend,
  attempt: attemptAction,
  vote: castVote,
  disclose,
  triage: confirmTriage,
  ack: acknowledgeNotice,
  report: reportIncident,
  receipt: checkReceipt,
  reset: () => resetDemo(),
};

/** Maps a thrown error to an HTTP response. Unknown errors are 500s with no detail. */
export function errorResponse(err: unknown): Response {
  if (err instanceof Forbidden)
    return Response.json({ error: err.reason }, { status: 403 });
  if (err instanceof NotFound)
    return Response.json({ error: err.message }, { status: 404 });
  if (err instanceof ValidationError)
    return Response.json(
      { error: err.userMessage ?? "Invalid input." },
      { status: 400 },
    );
  if (err instanceof Conflict)
    return Response.json({ error: err.message }, { status: 409 });
  console.error(err);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}
