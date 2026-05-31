import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberMobileRequestsController } from "../controllers/member/mobile-requests.controller";
import { AppDataSource } from "../data-source";
import { createMockResponse } from "./helpers/route-chain";

describe("member mobile requests controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects payment request creation when salon, day or package selection is missing", async () => {
    const req = {
      auth: { accountId: "acc-1", sub: "member-1" },
      body: { tenant_slug: "", selected_days: [], package_ids: [] },
    } as any;
    const res = createMockResponse();

    await expect(MemberMobileRequestsController.createPaymentRequest(req, res as any)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 422,
    });
  });

  it("lists payment requests with normalized statuses", async () => {
    const notificationRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: "evt-1",
          status: "QUEUED",
          created_at: "2026-04-23T09:00:00.000Z",
          payload: {
            amount: 4200,
            package_id: "pkg-1",
            trainer_id: "trainer-1",
            note: "Ödeme bekleniyor",
          },
        },
        {
          id: "evt-2",
          status: "PROCESSED",
          created_at: "2026-04-22T09:00:00.000Z",
          payload: {
            decision: "APPROVED",
            amount: 3900,
            package_id: "pkg-2",
          },
        },
      ]),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("NotificationEvent")) return notificationRepo as any;
      return {} as any;
    });

    const req = { auth: { sub: "member-1" } } as any;
    const res = createMockResponse();

    await MemberMobileRequestsController.listPaymentRequests(req, res as any);

    expect(res.body).toEqual({
      data: [
        {
          id: "evt-1",
          status: "PENDING",
          amount: 4200,
          currency: "TRY",
          package_id: "pkg-1",
          trainer_id: "trainer-1",
          note: "Ödeme bekleniyor",
        },
        {
          id: "evt-2",
          status: "APPROVED",
          amount: 3900,
          currency: "TRY",
          package_id: "pkg-2",
          trainer_id: null,
          note: null,
        },
      ],
    });
  });

  it("lists payment and change requests when payloads are stored as JSON text", async () => {
    const rows = [
      {
        id: "evt-payment",
        type: "MEMBER_PAYMENT_REQUEST",
        status: "QUEUED",
        created_at: "2026-04-23T09:00:00.000Z",
        payload: JSON.stringify({
          amount: 4200,
          package_id: "pkg-1",
          trainer_id: "trainer-1",
          note: "Odeme bekleniyor",
        }),
      },
      {
        id: "evt-change",
        type: "MEMBER_CHANGE_REQUEST",
        status: "QUEUED",
        created_at: "2026-04-23T10:00:00.000Z",
        payload: JSON.stringify({
          request_type: "TRAINER_CHANGE",
          status: "PENDING",
          note: "Egitmen degisimi",
        }),
      },
    ];
    const notificationRepo = {
      find: vi.fn(async (options: any) => rows.filter((row) => row.type === options.where.type)),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("NotificationEvent")) return notificationRepo as any;
      return {} as any;
    });

    const req = { tenantId: "tenant-1", auth: { sub: "member-1", accountId: "account-1" } } as any;

    const paymentRes = createMockResponse();
    await MemberMobileRequestsController.listPaymentRequests(req, paymentRes as any);
    expect(paymentRes.body.data).toEqual([
      expect.objectContaining({
        id: "evt-payment",
        status: "PENDING",
        amount: 4200,
        package_id: "pkg-1",
        trainer_id: "trainer-1",
        note: "Odeme bekleniyor",
      }),
    ]);

    const changeRes = createMockResponse();
    await MemberMobileRequestsController.listChangeRequests(req, changeRes as any);
    expect(changeRes.body.data).toEqual([
      expect.objectContaining({
        id: "evt-change",
        type: "TRAINER_CHANGE",
        status: "PENDING",
        reason: "Egitmen degisimi",
      }),
    ]);
  });

  it("rejects duplicate queued change requests of the same type", async () => {
    const notificationRepo = {
      find: vi.fn().mockResolvedValue([{ id: "evt-1", payload: { request_type: "PACKAGE_RENEWAL" } }]),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("NotificationEvent")) return notificationRepo as any;
      return {} as any;
    });

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1", accountId: "acc-1" },
      body: { type: "PACKAGE_RENEWAL", note: "Yeni paket istiyorum" },
    } as any;
    const res = createMockResponse();

    await expect(MemberMobileRequestsController.createChangeRequest(req, res as any)).rejects.toMatchObject({
      code: "CHANGE_REQUEST_EXISTS",
      statusCode: 409,
    });
  });

  it("rejects duplicate queued change requests even when the newest queued event has another type", async () => {
    const notificationRepo = {
      find: vi.fn().mockResolvedValue([
        { id: "evt-newer", payload: { request_type: "TRAINER_CHANGE" } },
        { id: "evt-older", payload: { request_type: "PACKAGE_RENEWAL" } },
      ]),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("NotificationEvent")) return notificationRepo as any;
      return {} as any;
    });

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1", accountId: "acc-1" },
      body: { type: "PACKAGE_RENEWAL", note: "Yeni paket istiyorum" },
    } as any;

    await expect(MemberMobileRequestsController.createChangeRequest(req, createMockResponse() as any)).rejects.toMatchObject({
      code: "CHANGE_REQUEST_EXISTS",
      statusCode: 409,
    });
  });

  it("stores and lists change requests by the active event owner id", async () => {
    const savedEvents: any[] = [];
    const notificationRepo = {
      find: vi.fn(async (options: any) => savedEvents.filter((row) => row.member_id === options.where.member_id)),
      create: vi.fn((value: any) => ({ id: "evt-created", created_at: "2026-05-11T09:00:00.000Z", ...value })),
      save: vi.fn(async (row: any) => {
        savedEvents.push(row);
        return row;
      }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("NotificationEvent")) return notificationRepo as any;
      if (name.includes("User")) return { find: vi.fn().mockResolvedValue([]) } as any;
      return {} as any;
    });

    const auth = { sub: "member-user-1", linkedUserId: "linked-member-1", accountId: "account-1" };
    await MemberMobileRequestsController.createChangeRequest(
      {
        tenantId: "tenant-1",
        auth,
        body: { type: "TRAINER_CHANGE", trainer_id: "trainer-2", note: "Degisim" },
      } as any,
      createMockResponse() as any
    );

    expect(notificationRepo.create).toHaveBeenCalledWith(expect.objectContaining({ member_id: "linked-member-1" }));

    const res = createMockResponse();
    await MemberMobileRequestsController.listChangeRequests({ tenantId: "tenant-1", auth } as any, res as any);

    expect(notificationRepo.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ member_id: "linked-member-1" }),
      })
    );
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: "evt-created",
        type: "TRAINER_CHANGE",
        status: "PENDING",
      }),
    ]);
  });
});
