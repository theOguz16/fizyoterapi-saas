type JsonPayload = unknown;

export function createMockResponse() {
  return {
    statusCode: 200,
    body: null as JsonPayload,
    headers: {} as Record<string, string>,
    locals: {} as Record<string, unknown>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: JsonPayload) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return this.headers[name.toLowerCase()];
    },
  };
}

export async function runRouteChain(
  steps: Array<(req: any, res: any, next?: (error?: unknown) => void) => unknown>,
  req: any,
  res = createMockResponse()
) {
  for (const step of steps) {
    let nextCalled = false;
    let nextError: unknown;

    await step(req, res, (error?: unknown) => {
      nextCalled = true;
      nextError = error;
    });

    if (nextError) throw nextError;
    if (!nextCalled) break;
  }

  return res;
}
