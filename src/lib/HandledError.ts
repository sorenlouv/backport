export class HandledError extends Error {
  constructor(message: string) {
    super(message);
    Error.captureStackTrace(this, HandledError);
    this.name = 'HandledError';
  }
}

export function printHandledError(e: HandledError, { rethrow = true } = {}) {
  if (e.name === 'HandledError') {
    console.error(e.message);
  } else {
    console.error(e);
    if (rethrow) {
      throw e;
    }
  }
}
