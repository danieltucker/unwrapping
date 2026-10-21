/**
 * Stands in for `next/navigation` in tests run under plain Node. redirect()
 * and notFound() throw, as Next's do, but with something a test can read.
 */
export class RedirectSignal extends Error {
  constructor(location) {
    super(`redirect to ${location}`);
    this.location = location;
  }
}

export class NotFoundSignal extends Error {
  constructor() {
    super("not found");
  }
}

export function redirect(location) {
  throw new RedirectSignal(location);
}

export function notFound() {
  throw new NotFoundSignal();
}
