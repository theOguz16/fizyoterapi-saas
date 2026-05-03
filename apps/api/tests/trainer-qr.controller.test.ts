import { afterEach, describe, expect, it, vi } from "vitest";
import { TrainerQrController } from "../controllers/trainer/qr.controller";
import { AppDataSource } from "../data-source";
import { createMockResponse } from "./helpers/route-chain";

describe("trainer qr controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses linked user id when trainer session is backed by account auth", async () => {
    const save = vi.fn();
    const findOne = vi.fn().mockResolvedValue({
      id: "trainer-1",
      tenant_id: "tenant-1",
      first_name: "Ayşe",
      last_name: "Yılmaz",
      email: "ayse@example.com",
      role: "TRAINER",
      qr_code: "TRN-ABC123",
    });

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue({
      findOne,
      save,
    } as any);

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "account-1", linkedUserId: "trainer-1" },
    } as any;
    const res = createMockResponse();

    await TrainerQrController.getMyQr(req, res as any);

    expect(findOne).toHaveBeenCalledWith({
      where: { tenant_id: "tenant-1", id: "trainer-1", role: "TRAINER" },
    });
    expect(save).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      data: {
        trainer_id: "trainer-1",
        full_name: "Ayşe Yılmaz",
        email: "ayse@example.com",
        qr_code: "TRN-ABC123",
      },
    });
  });
});
