import "server-only";
import type { BlockedEventType } from "./ledger/event-types";

export class Forbidden extends Error {
  /**
   * @param reason shown to the user.
   * @param opts go into the Blocked ledger entry; each defaults to the command's own.
   */
  constructor(
    public readonly reason: string,
    public readonly opts: {
      blocked?: BlockedEventType;
      caseId?: string;
      detail?: string;
    } = {},
  ) {
    super(reason);
    this.name = "Forbidden";
  }
}

export class NotFound extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "NotFound";
  }
}

export class ValidationError extends Error {
  /** @param userMessage shown to the user when the problem is theirs to fix (e.g. file too big). */
  constructor(
    public readonly issues: unknown,
    public readonly userMessage?: string,
  ) {
    super("invalid input");
    this.name = "ValidationError";
  }
}

export class Conflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Conflict";
  }
}
