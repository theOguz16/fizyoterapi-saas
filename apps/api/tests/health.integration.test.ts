import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("API smoke", () => {
  it("GET /health -> 200", async () => {
    const app = createApp();
    const router = ((app as any)?.router || (app as any)?._router) as any;
    const layers = (router?.stack || []) as Array<any>;
    const healthLayer = layers.find((layer) => layer?.route?.path === "/health");

    expect(healthLayer).toBeTruthy();

    const handler = healthLayer.route.stack[0].handle as (req: any, res: any) => void;
    const res = {
      statusCode: 200,
      body: null as any,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        this.body = payload;
        return this;
      },
    };

    await handler({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
