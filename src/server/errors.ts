import "server-only";

export class Forbidden extends Error {
  constructor(public readonly reason: string) {
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
  constructor(public readonly issues: unknown) {
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
