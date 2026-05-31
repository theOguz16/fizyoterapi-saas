import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminTrainersController } from "../controllers/admin/trainers.controller";
import { AppDataSource } from "../data-source";
import { createMockResponse } from "./helpers/route-chain";

type QueryBuilderResult = {
  getRawOne: () => Promise<{
    daily_income: string;
    weekly_income: string;
    monthly_income: string;
    yearly_income: string;
  }>;
};

function createAttendanceQueryBuilder(raw: {
  daily_income: string;
  weekly_income: string;
  monthly_income: string;
  yearly_income: string;
}): QueryBuilderResult & Record<string, () => QueryBuilderResult> {
  const builder = {
    leftJoin: vi.fn(),
    select: vi.fn(),
    addSelect: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    setParameter: vi.fn(),
    getRawOne: vi.fn().mockResolvedValue(raw),
  };

  builder.leftJoin.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  builder.addSelect.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);
  builder.setParameter.mockReturnValue(builder);

  return builder;
}

describe("admin trainers controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns numeric earnings totals for the requested trainer", async () => {
    const trainerRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "trainer-1" }),
    };
    const attendanceQuery = createAttendanceQueryBuilder({
      daily_income: "350.5",
      weekly_income: "1400",
      monthly_income: "6150.75",
      yearly_income: "47200",
    });
    const attendanceRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(attendanceQuery),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity) => {
      const entityName = typeof entity === "function" ? entity.name : "";
      if (entityName === "User") return trainerRepo as never;
      if (entityName === "Attendance") return attendanceRepo as never;
      return {} as never;
    });

    const req = {
      tenantId: "tenant-1",
      params: { id: "trainer-1" },
    };
    const res = createMockResponse();

    await AdminTrainersController.earningsSummary(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      data: {
        daily_income: 350.5,
        weekly_income: 1400,
        monthly_income: 6150.75,
        yearly_income: 47200,
      },
    });
  });
});
