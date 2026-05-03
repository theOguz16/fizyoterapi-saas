import { describe, expect, it } from "vitest";
import { MemberRealtimeController } from "../controllers/member/realtime.controller";
import { MemberRealtimeService } from "../services/member-realtime.service";

describe("MemberRealtimeController", () => {
  it("streams connected event and pushes calendar sync messages to the member", async () => {
    const writes: string[] = [];
    const listeners = new Map<string, () => void>();

    const req: any = {
      auth: { sub: "member-1" },
      on: (event: string, handler: () => void) => {
        listeners.set(event, handler);
      },
    };
    const res: any = {
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      flushHeaders() {
        return undefined;
      },
      write(chunk: string) {
        writes.push(chunk);
      },
      end() {
        writes.push("__end__");
      },
    };

    await MemberRealtimeController.stream(req, res);

    expect(res.headers["content-type"]).toBe("text/event-stream");
    expect(writes.join("")).toContain("event: connected");

    MemberRealtimeService.publish("member-1", {
      type: "calendar_sync",
      entity: "calendar",
      application_id: "app-1",
    });

    expect(writes.join("")).toContain("event: message");
    expect(writes.join("")).toContain("\"type\":\"calendar_sync\"");

    listeners.get("close")?.();

    const before = writes.length;
    MemberRealtimeService.publish("member-1", {
      type: "calendar_sync",
      entity: "calendar",
      application_id: "app-2",
    });

    expect(writes).toContain("__end__");
    expect(writes).toHaveLength(before);
  });
});
