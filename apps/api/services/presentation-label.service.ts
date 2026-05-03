// Bu servis modulu backend tarafinda presentation label.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { LessonCategory } from "../entities/class-session.entity";

export function lessonCategoryLabel(raw: unknown): string | null {
  const value = String(raw ?? "").trim().toUpperCase();
  if (!value) return null;

  if (value === LessonCategory.GRUP || value === "GROUP") return "Grup";
  if (value === LessonCategory.PT) return "PT";
  if (value === LessonCategory.SKOLYOZ || value === "SCOLIOSIS") return "Skolyoz";
  if (value === LessonCategory.PILATES) return "Pilates";
  if (value === LessonCategory.REFORMER) return "Reformer";
  return null;
}

export function packageDisplayName(rawTitle: unknown): string | null {
  const title = String(rawTitle ?? "").trim();
  return title || null;
}
