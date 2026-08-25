export function createTapGuard(cooldownMs = 650, now: () => number = Date.now) {
  let lastAcceptedAt = Number.NEGATIVE_INFINITY;
  return {
    tryAcquire() {
      const current = now();
      if (current - lastAcceptedAt < cooldownMs) return false;
      lastAcceptedAt = current;
      return true;
    },
  };
}

export function createAsyncSubmissionGuard() {
  let pending = false;
  return {
    get pending() {
      return pending;
    },
    async run<T>(task: () => Promise<T>): Promise<{ started: boolean; value?: T }> {
      if (pending) return { started: false };
      pending = true;
      try {
        return { started: true, value: await task() };
      } finally {
        pending = false;
      }
    },
  };
}
