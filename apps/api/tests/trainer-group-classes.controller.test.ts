import { afterEach, describe, expect, it, vi } from "vitest";
import { TrainerGroupClassesController } from "../controllers/trainer/group-classes.controller";
import { AppDataSource } from "../data-source";
import { GroupClassNotificationScope, SessionStatus, SessionType } from "../entities/class-session.entity";
import { NotificationEventStatus } from "../entities/notification-event.entity";
import { createMockResponse } from "./helpers/route-chain";

describe("trainer group classes controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reuses an older queued cancel request for the same group class", async () => {
    const session = {
      id: "session-1",
      tenant_id: "tenant-1",
      trainer_id: "trainer-1",
      type: SessionType.GROUP,
      status: SessionStatus.SCHEDULED,
      title: "Mat Pilates",
      special_date: null,
      recurrence_label: null,
      notification_scope: GroupClassNotificationScope.SALON_MEMBERS,
      price: 0,
    };
    const existingCancel = {
      id: "evt-cancel",
      status: NotificationEventStatus.QUEUED,
      payload: { request_type: "GROUP_CLASS_CANCEL", session_id: "session-1" },
    };
    const sessionRepo = {
      findOne: vi.fn().mockResolvedValue(session),
    };
    const eventRepo = {
      find: vi.fn().mockResolvedValue([
        { id: "evt-newer", status: NotificationEventStatus.QUEUED, payload: { request_type: "OTHER" } },
        existingCancel,
      ]),
      create: vi.fn(),
      save: vi.fn(),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("ClassSession")) return sessionRepo as any;
      if (name.includes("NotificationEvent")) return eventRepo as any;
      return {} as any;
    });

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "trainer-1" },
      params: { id: "session-1" },
    } as any;
    const res = createMockResponse();

    await TrainerGroupClassesController.remove(req, res as any);

    expect(eventRepo.create).not.toHaveBeenCalled();
    expect(eventRepo.save).not.toHaveBeenCalled();
    expect(res.body.data).toEqual({
      id: "evt-cancel",
      session_id: "session-1",
      status: "PENDING",
      request_type: "GROUP_CLASS_CANCEL",
    });
  });
});
