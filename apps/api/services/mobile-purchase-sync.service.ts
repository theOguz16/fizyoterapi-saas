// Bu servis modulu backend tarafinda mobile purchase sync.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { AppDataSource } from "../data-source";
import { Availability } from "../entities/availability.entity";
import { NotificationEvent } from "../entities/notification-event.entity";
import { Booking, BookingPaymentStatus, BookingStatus } from "../entities/booking.entity";
import { ClassSession, SessionStatus } from "../entities/class-session.entity";
import { Package } from "../entities/package.entity";
import { PackageTrainerAssignment } from "../entities/package-trainer-assignment.entity";
import { SalonApplication } from "../entities/salon-application.entity";
import { User, UserRole } from "../entities/user.entity";
import { UserPackage } from "../entities/user-package.entity";

type PurchaseSlot = {
  starts_at: string;
  ends_at: string;
  label?: string | null;
  package_id?: string | null;
  package_title?: string | null;
  weekday_label?: string | null;
  time_range_label?: string | null;
  group_class_id?: string | null;
  lesson_name?: string | null;
  is_group_class?: boolean | null;
};

type PurchaseContext = {
  package_id: string;
  package_ids?: string[];
  selected_packages?: Array<{
    package_id: string;
    package_title?: string | null;
    package_price?: number | string | null;
  }>;
  package_title?: string | null;
  trainer_id?: string | null;
  trainer_name?: string | null;
  selected_sub_lesson?: string | null;
  selected_days: PurchaseSlot[];
  note?: string | null;
  availability_context?: {
    source?: string | null;
    visibility?: string | null;
    selected_by?: string | null;
  } | null;
};

const MEMBER_PAYMENT_REQUEST = "MEMBER_PAYMENT_REQUEST";

// Mobil satin alma akisinda kullanicinin sectigi paket/gun/egitmen bilgisi
// once gecici request/event verilerinde tasiniyor.
// Bu servis onay sonrasi o gecici baglami kalici tablo kayitlarina senkronize eder.
function safeParseJson<T>(raw: unknown): T | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isPurchaseSlotArray(raw: unknown): raw is PurchaseSlot[] {
  return Array.isArray(raw);
}

function normalizeSelectedPackages(raw: unknown) {
  if (!Array.isArray(raw)) return [] as Array<{ package_id: string; package_title: string | null; package_price: string | number | null }>;
  return raw
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
      const packageId = typeof row?.package_id === "string" ? row.package_id.trim() : "";
      if (!packageId) return null;
      return {
        package_id: packageId,
        package_title: typeof row?.package_title === "string" ? row.package_title : null,
        package_price:
          typeof row?.package_price === "number" || typeof row?.package_price === "string" ? row.package_price : null,
      };
    })
    .filter((row): row is { package_id: string; package_title: string | null; package_price: string | number | null } => row !== null);
}

export class MobilePurchaseSyncService {
  static normalizePurchaseContext(raw: unknown): PurchaseContext | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const payload = raw as Record<string, unknown>;
    const primaryPackageId = typeof payload.package_id === "string" ? payload.package_id : "";
    const packageIds = Array.isArray(payload.package_ids)
      ? payload.package_ids.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];
    const selectedPackages = normalizeSelectedPackages(payload.selected_packages);
    const normalizedPackageIds = Array.from(
      new Set([primaryPackageId, ...packageIds, ...selectedPackages.map((item) => item.package_id)].filter(Boolean))
    );
    if (normalizedPackageIds.length === 0 || !isPurchaseSlotArray(payload.selected_days)) {
      return null;
    }

    return {
      package_id: normalizedPackageIds[0],
      package_ids: normalizedPackageIds,
      selected_packages: selectedPackages,
      package_title: typeof payload.package_title === "string" ? payload.package_title : null,
      trainer_id: typeof payload.trainer_id === "string" ? payload.trainer_id : null,
      trainer_name: typeof payload.trainer_name === "string" ? payload.trainer_name : null,
      selected_sub_lesson: typeof payload.selected_sub_lesson === "string" ? payload.selected_sub_lesson : null,
      selected_days: payload.selected_days,
      note: typeof payload.note === "string" ? payload.note : null,
      availability_context:
        payload.availability_context && typeof payload.availability_context === "object"
          ? (payload.availability_context as PurchaseContext["availability_context"])
          : null,
    };
  }

  static buildAvailabilityNote(input: {
    trainerId?: string | null;
    trainerName?: string | null;
    packageTitle?: string | null;
  }) {
    const metadataPrefix = input.trainerId ? `PT:${input.trainerId}|` : "";
    const display = [
      "Üye uygunluk tercihi",
      input.packageTitle ? `Paket: ${input.packageTitle}` : null,
      input.trainerName ? `Egitmen: ${input.trainerName}` : null,
    ]
      .filter(Boolean)
      .join(" • ")
      .slice(0, 220);
    return `${metadataPrefix}${display}`.slice(0, 240);
  }

  static parseAvailabilityNote(note?: string | null) {
    const raw = String(note || "");
    if (!raw) {
      return { preferredTrainerId: null, displayNote: null };
    }
    const match = raw.match(/^PT:([^|]+)\|(.*)$/);
    if (!match) {
      return { preferredTrainerId: null, displayNote: raw };
    }
    return {
      preferredTrainerId: match[1] || null,
      displayNote: (match[2] || "").trim() || null,
    };
  }

  private static deriveWeeklyClassHours(pkg?: Pick<Package, "total_credits" | "duration_days" | "rules"> | null) {
    const rules = pkg?.rules && typeof pkg.rules === "object" ? (pkg.rules as Record<string, unknown>) : {};
    const explicit = Number(rules.weekly_class_hours ?? rules.weekly_sessions ?? rules.sessions_per_week ?? 0);
    if (Number.isFinite(explicit) && explicit >= 1) {
      return Math.min(7, Math.max(1, Math.floor(explicit)));
    }
    const durationDays = Number(pkg?.duration_days || 0);
    const totalCredits = Number(pkg?.total_credits || 0);
    if (durationDays > 0 && totalCredits > 0) {
      return Math.min(7, Math.max(1, Math.round(totalCredits / Math.max(1, durationDays / 7))));
    }
    if (totalCredits > 0) {
      return Math.min(7, Math.max(1, Math.round(totalCredits / 4)));
    }
    return 1;
  }

  private static startOfIsoWeek(date: Date) {
    const dt = new Date(date);
    const day = dt.getDay() || 7;
    dt.setDate(dt.getDate() - day + 1);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  private static endOfIsoWeek(date: Date) {
    const start = MobilePurchaseSyncService.startOfIsoWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  static async resolvePurchaseContext(application: SalonApplication): Promise<PurchaseContext | null> {
    // Yeni akista secimler application.note icinde tutuluyor.
    // Geriye donuk uyumluluk icin eski notification event kaydi da okunuyor.
    const notePayload = safeParseJson<Record<string, unknown>>(application.note);
    const parsedFromNote = MobilePurchaseSyncService.normalizePurchaseContext(notePayload);
    if (parsedFromNote) {
      return parsedFromNote;
    }

    const event = await AppDataSource.getRepository(NotificationEvent)
      .createQueryBuilder("event")
      .where("event.tenant_id = :tenantId", { tenantId: application.tenant_id })
      .andWhere("event.type = :type", { type: MEMBER_PAYMENT_REQUEST })
      .andWhere("event.payload ->> 'application_id' = :applicationId", { applicationId: application.id })
      .orderBy("event.created_at", "DESC")
      .getOne();

    if (!event?.payload || typeof event.payload !== "object") {
      return null;
    }

    const payload = event.payload as Record<string, unknown>;
    return MobilePurchaseSyncService.normalizePurchaseContext(payload);
  }

  static summarizePurchaseContext(context: PurchaseContext | null) {
    if (!context) return null;
    const firstSlots = context.selected_days
      .slice(0, 3)
      .map((row) => {
        const weekday = row.weekday_label || row.label || "Saat";
        const time = row.time_range_label || "";
        return `${weekday}${time ? ` ${time}` : ""}`.trim();
      })
      .filter(Boolean);

    const parts = [
      (context.selected_packages?.length || 0) > 1
        ? `Paketler: ${(context.selected_packages || []).map((item) => item.package_title || item.package_id).join(", ")}`
        : context.package_title
          ? `Paket: ${context.package_title}`
          : null,
      context.trainer_name ? `Egitmen: ${context.trainer_name}` : context.trainer_id ? `Egitmen: ${context.trainer_id}` : null,
      context.selected_sub_lesson ? `Alt ders: ${context.selected_sub_lesson}` : null,
      context.selected_days.length ? `Tercih: ${context.selected_days.length} slot` : null,
      firstSlots.length ? `Ornek: ${firstSlots.join(", ")}` : null,
    ].filter(Boolean);

    return parts.length ? parts.join(" • ") : null;
  }

  static async applyApprovedPurchase(params: {
    tenantId: string;
    memberUser: User;
    application: SalonApplication;
    requestId?: string | null;
  }) {
    const { tenantId, memberUser, application, requestId } = params;
    const context = await MobilePurchaseSyncService.resolvePurchaseContext(application);
    return MobilePurchaseSyncService.applyApprovedPurchaseContext({
      tenantId,
      memberUser,
      context,
      requestId: requestId || application.id,
    });
  }

  static async applyApprovedPurchaseContext(params: {
    tenantId: string;
    memberUser: User;
    context: PurchaseContext | null;
    requestId?: string | null;
  }) {
    const { tenantId, memberUser, context, requestId } = params;
    if (!context) return null;

    const packageRepo = AppDataSource.getRepository(Package);
    const userRepo = AppDataSource.getRepository(User);
    const userPackageRepo = AppDataSource.getRepository(UserPackage);
    const availabilityRepo = AppDataSource.getRepository(Availability);
    const bookingRepo = AppDataSource.getRepository(Booking);
    const sessionRepo = AppDataSource.getRepository(ClassSession);
    const assignmentRepo = AppDataSource.getRepository(PackageTrainerAssignment);
    const packageIds = Array.from(new Set([context.package_id, ...(context.package_ids || [])].filter(Boolean)));
    const packages = packageIds.length
      ? await packageRepo.find({
          where: packageIds.map((id) => ({ tenant_id: tenantId, id, is_active: true })),
        })
      : [];
    if (packages.length === 0) return null;
    const pkg = packages[0];
    const packageMap = new Map(packages.map((item) => [item.id, item]));
    let resolvedTrainerId = context.trainer_id || null;
    if (!resolvedTrainerId && pkg?.id) {
      const fallbackAssignment = await assignmentRepo.findOne({
        where: {
          tenant_id: tenantId,
          package_id: pkg.id,
          is_active: true,
        },
      });
      resolvedTrainerId = fallbackAssignment?.trainer_id || null;
    }

    // Paket onayi uye profilindeki haftalik ders ritmini de etkiler.
    // Bu alan daha sonra planlama ve dashboard ekranlarinda kullaniliyor.
    const weeklyClassHours = packages.reduce((sum, item) => sum + MobilePurchaseSyncService.deriveWeeklyClassHours(item), 0);
    if ((memberUser.weekly_class_hours || 1) !== weeklyClassHours) {
      memberUser.weekly_class_hours = weeklyClassHours;
      await userRepo.save(memberUser);
    }

    const startsAt = new Date();
    let expiresAt: Date | undefined;
    if (pkg.duration_days > 0) {
      expiresAt = new Date(startsAt);
      expiresAt.setDate(expiresAt.getDate() + pkg.duration_days);
    }

    for (const selectedPackageId of packageIds) {
      const packageRow = packageMap.get(selectedPackageId);
      if (!packageRow) continue;
      const selectedPrice =
        context.selected_packages?.find((item) => item.package_id === selectedPackageId)?.package_price ?? packageRow.display_price ?? null;
      const existingUserPackage = await userPackageRepo.findOne({
        where: {
          tenant_id: tenantId,
          user_id: memberUser.id,
          package_id: packageRow.id,
          is_active: true,
        },
        order: { created_at: "DESC" as never },
      });

      if (existingUserPackage) {
          const sameRequestAlreadyApplied =
            Boolean(requestId) && existingUserPackage.source_request_id === requestId;

          if (!sameRequestAlreadyApplied) {
            existingUserPackage.remaining_credits += Math.max(0, Number(packageRow.total_credits || 0));
          }

          existingUserPackage.starts_at = existingUserPackage.starts_at || startsAt;
          existingUserPackage.expires_at = expiresAt ?? existingUserPackage.expires_at;
          existingUserPackage.latest_package_price = packageRow.display_price ?? existingUserPackage.latest_package_price ?? null;
          existingUserPackage.purchase_price = String(selectedPrice ?? existingUserPackage.purchase_price ?? packageRow.display_price ?? "");
          existingUserPackage.package_snapshot = {
            title: packageRow.title,
            type: packageRow.type,
            total_credits: packageRow.total_credits,
            duration_days: packageRow.duration_days,
            rules: packageRow.rules,
          };
          existingUserPackage.source_request_id = requestId || existingUserPackage.source_request_id || null;
          await userPackageRepo.save(existingUserPackage);
        }else {
        await userPackageRepo.save(
          userPackageRepo.create({
            tenant_id: tenantId,
            user_id: memberUser.id,
            package_id: packageRow.id,
            remaining_credits: packageRow.total_credits,
            starts_at: startsAt,
            expires_at: packageRow.duration_days > 0 ? expiresAt : undefined,
            is_active: true,
            purchase_price: selectedPrice === null || selectedPrice === undefined ? null : String(selectedPrice),
            latest_package_price: packageRow.display_price ?? null,
            package_snapshot: {
              title: packageRow.title,
              type: packageRow.type,
              total_credits: packageRow.total_credits,
              duration_days: packageRow.duration_days,
              rules: packageRow.rules,
            },
            source_request_id: requestId || null,
          })
        );
      }
    }

    const trainerRow =
      !context.trainer_name && resolvedTrainerId
        ? await userRepo.findOne({
            where: { tenant_id: tenantId, id: resolvedTrainerId, role: UserRole.TRAINER },
            select: ["id", "first_name", "last_name"],
          })
        : null;
    const trainerName = context.trainer_name || (trainerRow ? `${trainerRow.first_name} ${trainerRow.last_name}`.trim() : null);

    const normalizedSlots = context.selected_days
      .map((row) => {
        const slotStart = new Date(String(row.starts_at));
        const slotEnd = new Date(String(row.ends_at));
        if (Number.isNaN(slotStart.getTime()) || Number.isNaN(slotEnd.getTime()) || slotEnd <= slotStart) {
          return null;
        }
        const slotPackageId = typeof row.package_id === "string" && row.package_id.trim() ? row.package_id.trim() : pkg.id;
        const slotPackage = packageMap.get(slotPackageId);
        return {
          starts_at: slotStart,
          ends_at: slotEnd,
          package_id: slotPackageId,
          package_title: typeof row.package_title === "string" && row.package_title.trim()
            ? row.package_title.trim()
            : slotPackage?.title || context.package_title || pkg.title,
          group_class_id:
            typeof row.group_class_id === "string" && row.group_class_id.trim() ? row.group_class_id.trim() : null,
          lesson_name:
            typeof row.lesson_name === "string" && row.lesson_name.trim() ? row.lesson_name.trim() : null,
          is_group_class: Boolean(row.is_group_class),
        };
      })
      .filter((row): row is { starts_at: Date; ends_at: Date; package_id: string; package_title: string; group_class_id: string | null; lesson_name: string | null; is_group_class: boolean } => Boolean(row));

    const groupSessionIds = Array.from(
      new Set(normalizedSlots.map((slot) => slot.group_class_id).filter(Boolean))
    ) as string[];
    const groupSessions = groupSessionIds.length
      ? await sessionRepo.find({
          where: groupSessionIds.map((id) => ({
            tenant_id: tenantId,
            id,
            status: SessionStatus.SCHEDULED,
          })) as any,
        })
      : [];
    const groupSessionMap = new Map(groupSessions.map((session) => [session.id, session]));
    const groupBookingCounts = await Promise.all(
      groupSessions.map(async (session) => {
        const count = await bookingRepo.count({
          where: {
            tenant_id: tenantId,
            session_id: session.id,
            status: BookingStatus.APPROVED,
          },
        });
        return [session.id, count] as const;
      })
    );
    const groupBookingCountMap = new Map(groupBookingCounts);

    const directGroupSlots = normalizedSlots.filter((slot) => slot.group_class_id && groupSessionMap.has(String(slot.group_class_id)));
    for (const slot of directGroupSlots) {
      const session = groupSessionMap.get(String(slot.group_class_id));
      if (!session?.trainer_id) continue;
      const existingBooking = await bookingRepo.findOne({
        where: {
          tenant_id: tenantId,
          member_id: memberUser.id,
          session_id: session.id,
        },
      });
      if (existingBooking) continue;
      const approvedCount = Number(groupBookingCountMap.get(session.id) || 0);
      if (session.capacity > 0 && approvedCount >= session.capacity) {
        continue;
      }
      await bookingRepo.save(
        bookingRepo.create({
          tenant_id: tenantId,
          member_id: memberUser.id,
          trainer_id: session.trainer_id,
          session_id: session.id,
          starts_at: session.starts_at,
          ends_at: session.ends_at,
          status: BookingStatus.APPROVED,
          payment_status: BookingPaymentStatus.APPROVED,
          payment_approved_at: new Date(),
          meta: {
            package_id: slot.package_id,
            package_ids: packageIds,
            package_title: slot.package_title,
            selected_sub_lesson: context.selected_sub_lesson || slot.lesson_name || session.title,
            request_id: requestId || null,
            source: "MOBILE_GROUP_CLASS_APPROVAL",
            is_group_class: true,
            group_class_id: session.id,
            lesson_category: session.lesson_category,
            price: session.price ?? null,
          },
        })
      );
      groupBookingCountMap.set(session.id, approvedCount + 1);
    }

    const nonGroupSlots = normalizedSlots.filter((slot) => !slot.group_class_id || !groupSessionMap.has(String(slot.group_class_id)));

    if (nonGroupSlots.length > 0) {
      const weekGroups = new Map<string, Array<{ starts_at: Date; ends_at: Date; package_id: string; package_title: string }>>();
      for (const slot of nonGroupSlots) {
        const weekStart = MobilePurchaseSyncService.startOfIsoWeek(slot.starts_at).toISOString();
        weekGroups.set(weekStart, [...(weekGroups.get(weekStart) || []), slot]);
      }

      for (const slots of weekGroups.values()) {
        const weekStart = MobilePurchaseSyncService.startOfIsoWeek(slots[0].starts_at);
        const weekEnd = MobilePurchaseSyncService.endOfIsoWeek(slots[0].starts_at);
        // Ayni hafta icin once eski tercihleri silip sonra yeniden yaziyoruz.
        // Boylece kullanicinin son secimi haftalik kaynakta tek dogru set olarak kalir.
        await availabilityRepo
          .createQueryBuilder()
          .delete()
          .where("tenant_id = :tenantId", { tenantId })
          .andWhere("member_id = :memberId", { memberId: memberUser.id })
          .andWhere("starts_at <= :weekEnd", { weekEnd })
          .andWhere("ends_at >= :weekStart", { weekStart })
          .execute();

        await availabilityRepo.save(
          slots.map((slot) =>
            availabilityRepo.create({
              tenant_id: tenantId,
              member_id: memberUser.id,
              starts_at: slot.starts_at,
              ends_at: slot.ends_at,
              package_id: slot.package_id,
              note: MobilePurchaseSyncService.buildAvailabilityNote({
                trainerId: resolvedTrainerId,
                trainerName,
                packageTitle: slot.package_title,
              }),
            })
          )
        );
      }

      if (resolvedTrainerId) {
        for (const slot of nonGroupSlots) {
          const existingBooking = await bookingRepo.findOne({
            where: {
              tenant_id: tenantId,
              member_id: memberUser.id,
              trainer_id: resolvedTrainerId,
              starts_at: slot.starts_at,
              ends_at: slot.ends_at,
            },
          });
          if (existingBooking) continue;
          await bookingRepo.save(
            bookingRepo.create({
              tenant_id: tenantId,
              member_id: memberUser.id,
              trainer_id: resolvedTrainerId,
              starts_at: slot.starts_at,
              ends_at: slot.ends_at,
              status: BookingStatus.PENDING,
              payment_status: BookingPaymentStatus.APPROVED,
              payment_approved_at: new Date(),
              meta: {
                package_id: slot.package_id,
                package_ids: packageIds,
                package_title: slot.package_title,
                selected_sub_lesson: context.selected_sub_lesson || null,
                request_id: requestId || null,
                source: "MOBILE_PURCHASE_APPROVAL",
                trainer_resolution: context.trainer_id ? "EXPLICIT" : "PACKAGE_ASSIGNMENT_FALLBACK",
              },
            })
          );
        }
      }
    }

    return {
      package_id: pkg.id,
      package_ids: packageIds,
      package_title: context.package_title || pkg.title,
      weekly_class_hours: weeklyClassHours,
      selected_slot_count: normalizedSlots.length,
      trainer_id: resolvedTrainerId,
      trainer_name: trainerName,
      summary: MobilePurchaseSyncService.summarizePurchaseContext(context),
    };
  }
}
