import { Availability } from "../entities/availability.entity";

type AvailabilityLike = Pick<Availability, "id" | "member_id" | "starts_at" | "ends_at" | "package_id" | "note">;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function buildProjectionId(baseId: string, startsAt: Date) {
  return `${baseId}:${startsAt.toISOString()}`;
}

export class AvailabilityProjectionService {
  static projectWeeklyRange<T extends AvailabilityLike>(rows: T[], from: Date, to: Date): T[] {
    if (!rows.length || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return [];
    }

    const projected: T[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const templateStart = toDate(row.starts_at);
      const templateEnd = toDate(row.ends_at);
      if (Number.isNaN(templateStart.getTime()) || Number.isNaN(templateEnd.getTime()) || templateEnd <= templateStart) {
        continue;
      }

      let offset = 0;
      if (templateEnd <= from) {
        offset = Math.floor((from.getTime() - templateStart.getTime()) / WEEK_MS);
      }

      let occurrenceStart = new Date(templateStart.getTime() + offset * WEEK_MS);
      let occurrenceEnd = new Date(templateEnd.getTime() + offset * WEEK_MS);

      while (occurrenceEnd <= from) {
        occurrenceStart = new Date(occurrenceStart.getTime() + WEEK_MS);
        occurrenceEnd = new Date(occurrenceEnd.getTime() + WEEK_MS);
      }

      while (occurrenceStart < to) {
        if (occurrenceEnd > from) {
          const key = [
            row.member_id || "",
            occurrenceStart.toISOString(),
            occurrenceEnd.toISOString(),
            row.package_id || "",
            row.note || "",
          ].join("|");
          if (!seen.has(key)) {
            seen.add(key);
            projected.push({
              ...row,
              id: buildProjectionId(row.id, occurrenceStart),
              starts_at: occurrenceStart,
              ends_at: occurrenceEnd,
            });
          }
        }

        occurrenceStart = new Date(occurrenceStart.getTime() + WEEK_MS);
        occurrenceEnd = new Date(occurrenceEnd.getTime() + WEEK_MS);
      }
    }

    return projected.sort((a, b) => toDate(a.starts_at).getTime() - toDate(b.starts_at).getTime());
  }

  static matchesWeeklyPattern<T extends AvailabilityLike>(rows: T[], startsAt: Date, endsAt: Date) {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      return false;
    }

    return rows.some((row) => {
      const templateStart = toDate(row.starts_at);
      const templateEnd = toDate(row.ends_at);
      if (Number.isNaN(templateStart.getTime()) || Number.isNaN(templateEnd.getTime()) || templateEnd <= templateStart) {
        return false;
      }
      const startDiff = startsAt.getTime() - templateStart.getTime();
      const endDiff = endsAt.getTime() - templateEnd.getTime();
      return startDiff >= 0 && startDiff % WEEK_MS === 0 && endDiff === startDiff;
    });
  }
}
