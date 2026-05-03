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

  it("rejects duplicate queued change requests of the same type", async () => {
    const notificationRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "evt-1",
        payload: { request_type: "PACKAGE_RENEWAL" },
      }),
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
});
