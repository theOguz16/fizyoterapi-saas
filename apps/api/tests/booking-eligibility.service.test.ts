import { describe, expect, it } from "vitest";
import { LessonCategory } from "../entities/class-session.entity";
import { BookingEligibilityService } from "../services/booking-eligibility.service";

describe("booking eligibility service", () => {
  it("normalizes lesson categories from Turkish and English aliases", () => {
    expect(BookingEligibilityService.normalizeLessonCategory("group")).toBe(LessonCategory.GRUP);
    expect(BookingEligibilityService.normalizeLessonCategory("SKOLYOZ")).toBe(LessonCategory.SKOLYOZ);
    expect(BookingEligibilityService.normalizeLessonCategory("pt")).toBe(LessonCategory.PT);
    expect(BookingEligibilityService.normalizeLessonCategory("unknown")).toBeNull();
  });

  it("builds member bookable package maps with diagnostics", () => {
    const result = BookingEligibilityService.buildMemberBookablePackageMap(
      ["member-1", "member-2", "member-3"],
      new Map([
        ["member-1", new Set(["pkg-a", "pkg-b"])],
        ["member-2", new Set(["pkg-c"])],
      ]),
      ["pkg-b", "pkg-c"],
      {
        packageLessonCategoryMap: {
          "pkg-a": LessonCategory.GRUP,
          "pkg-b": LessonCategory.PT,
          "pkg-c": LessonCategory.SKOLYOZ,
        },
        trainerSkillSet: new Set([LessonCategory.PT]),
      }
    );

    expect(result.memberActivePackageIds["member-1"]).toEqual(["pkg-a", "pkg-b"]);
    expect(result.memberBookablePackageIds["member-1"]).toEqual(["pkg-b"]);
    expect(result.memberBookablePackageIds["member-2"]).toEqual([]);
    expect(result.memberPackageDiagnostics["member-2"].reason_codes).toEqual(["NO_SKILL_MATCH"]);
    expect(result.memberPackageDiagnostics["member-3"].reason_codes).toEqual(["NO_MEMBER_ACTIVE_PACKAGE"]);
  });
});
