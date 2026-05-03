import { Response } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { MemberRealtimeService } from "../../services/member-realtime.service";

export class MemberRealtimeController {
  static async stream(req: AuthenticatedRequest, res: Response) {
    const auth = req.auth;
    const subscriptionKeys = Array.from(new Set([auth?.sub, auth?.linkedUserId, auth?.accountId].filter(Boolean) as string[]));
    if (!subscriptionKeys.length) {
      throw new AppError("NO_TENANT_OR_AUTH", 400, "Üye bilgisi bulunamadı");
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (input: { event: string; data: Record<string, unknown> }) => {
      res.write(`event: ${input.event}\n`);
      res.write(`data: ${JSON.stringify(input.data)}\n\n`);
    };

    send({
      event: "connected",
      data: { ok: true, ts: new Date().toISOString() },
    });

    const heartbeat = setInterval(() => {
      send({
        event: "heartbeat",
        data: { ts: new Date().toISOString() },
      });
    }, 25_000);

    const unsubscribeAll = subscriptionKeys.map((key) =>
      MemberRealtimeService.subscribe(key, (payload) => {
        send(payload);
      })
    );

    req.on("close", () => {
      clearInterval(heartbeat);
      for (const unsubscribe of unsubscribeAll) {
        unsubscribe();
      }
      res.end();
    });
  }
}
