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

  it("GET /ready -> 503 when database is not initialized", async () => {
    const app = createApp();
    const router = ((app as any)?.router || (app as any)?._router) as any;
    const layers = (router?.stack || []) as Array<any>;
    const readyLayer = layers.find((layer) => layer?.route?.path === "/ready");

    expect(readyLayer).toBeTruthy();

    const handler = readyLayer.route.stack[0].handle as (req: any, res: any) => Promise<void>;
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

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ ok: false, database: "not_initialized" });
  });

  it("GET /live -> 200 with runtime metadata", async () => {
    const app = createApp();
    const router = ((app as any)?.router || (app as any)?._router) as any;
    const layers = (router?.stack || []) as Array<any>;
    const liveLayer = layers.find((layer) => layer?.route?.path === "/live");

    expect(liveLayer).toBeTruthy();

    const handler = liveLayer.route.stack[0].handle as (req: any, res: any) => void;
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
    expect(res.body).toEqual({
      ok: true,
      uptime_seconds: expect.any(Number),
      timestamp: expect.any(String),
    });
  });
});
