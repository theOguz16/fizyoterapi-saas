// Bu controller admin tarafindaki bookings.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { Booking, BookingPaymentStatus, BookingStatus } from "../../entities/booking.entity";
import { ClassSession, LessonCategory } from "../../entities/class-session.entity";
import { Package } from "../../entities/package.entity";
import { User } from "../../entities/user.entity";
import { AuditLogService } from "../../services/audit-log.service";


export class AdminBookingsController {
  private static async logBookingAudit(
    req: AuthenticatedRequest,
    input: {
      eventType: string;
      booking: Booking;
      oldState?: Record<string, unknown> | null;
    }
  ) {
    await AuditLogService.log({
      tenant_id: req.tenantId || req.auth?.tenantId || null,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: input.eventType,
      action: input.eventType,
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "booking",
      target_id: input.booking.id,
      metadata: {
        booking_id: input.booking.id,
        member_id: input.booking.member_id,
        trainer_id: input.booking.trainer_id,
        session_id: input.booking.session_id ?? null,
        status: input.booking.status,
        starts_at: input.booking.starts_at.toISOString(),
        ends_at: input.booking.ends_at.toISOString(),
        old_state: input.oldState ?? null,
      },
    });
  }

  private static validateStatus(status: unknown): asserts status is BookingStatus {
    if (typeof status !== "string" || !Object.values(BookingStatus).includes(status as BookingStatus)) {
      throw new AppError("VALIDATION_ERROR", 400, "Geçersiz booking status değeri");
    }
  }

  private static parseDate(value: unknown, field: string) {
    const date = new Date(String(value));
    if (isNaN(date.getTime())) {
      throw new AppError("VALIDATION_ERROR", 400, `${field} geçerli bir tarih olmalıdır`);
    }
    return date;
  }

  private static lessonCategoryLabel(category?: string | null) {
    if (category === LessonCategory.GRUP) return "Grup";
    if (category === LessonCategory.PT) return "PT";
    if (category === LessonCategory.SKOLYOZ) return "Skolyoz";
    if (category === LessonCategory.PILATES) return "Pilates";
    if (category === LessonCategory.REFORMER) return "Reformer";
    return category || null;
  }

  private static normalizeLessonCategory(value: unknown): LessonCategory | null {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (!normalized) return null;
    return Object.values(LessonCategory).includes(normalized as LessonCategory)
      ? (normalized as LessonCategory)
      : null;
  }

  // --- GET /api/admin/bookings ---
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const trainerId = String(req.query.trainer_id ?? "").trim();
      const memberId = String(req.query.member_id ?? "").trim();
      const memberQuery = String(req.query.member_query ?? "").trim().toLocaleLowerCase("tr");
      const status = req.query.status ? String(req.query.status).trim().toUpperCase() : "";
      const from = req.query.from ? AdminBookingsController.parseDate(req.query.from, "from") : null;
      const to = req.query.to ? AdminBookingsController.parseDate(req.query.to, "to") : null;

      const qb = AppDataSource.getRepository(Booking)
        .createQueryBuilder("b")
        .where("b.tenant_id = :tenantId", { tenantId });

      if (trainerId) {
        qb.andWhere("b.trainer_id = :trainerId", { trainerId });
      }

      if (memberId) {
        qb.andWhere("b.member_id = :memberId", { memberId });
      }

      if (status) {
        AdminBookingsController.validateStatus(status);
        qb.andWhere("b.status = :status", { status });
      }

      if (from && to) {
        qb.andWhere("b.starts_at < :to", { to }).andWhere("b.ends_at > :from", { from });
      } else if (from) {
        qb.andWhere("b.ends_at > :from", { from });
      } else if (to) {
        qb.andWhere("b.starts_at < :to", { to });
      }

      const bookings = await qb.orderBy("b.starts_at", "ASC").getMany();

      const sessionIds = Array.from(new Set(bookings.map((row) => row.session_id).filter(Boolean)));
      const packageIds = Array.from(
        new Set(
          bookings
            .map((row) => String(((row.meta as Record<string, unknown> | undefined)?.package_id ?? "") as string))
            .filter(Boolean)
        )
      );
      const userIds = Array.from(
        new Set(
          bookings.flatMap((row) => [row.member_id, row.trainer_id]).filter(Boolean)
        )
      );

      const [sessions, packages, users] = await Promise.all([
        sessionIds.length
          ? AppDataSource.getRepository(ClassSession).find({
              where: sessionIds.map((id) => ({ tenant_id: tenantId, id: String(id) })),
              select: ["id", "title", "type", "lesson_category"],
            })
          : Promise.resolve([]),
        packageIds.length
          ? AppDataSource.getRepository(Package).find({
              where: packageIds.map((id) => ({ tenant_id: tenantId, id })),
              select: ["id", "title", "display_price", "rules"],
            })
          : Promise.resolve([]),
        userIds.length
          ? AppDataSource.getRepository(User).find({
              where: userIds.map((id) => ({ tenant_id: tenantId, id })),
              select: ["id", "first_name", "last_name", "email", "phone"],
            })
          : Promise.resolve([]),
      ]);

      const sessionMap = new Map(sessions.map((row) => [row.id, row]));
      const packageMap = new Map(packages.map((row) => [row.id, row]));
      const userMap = new Map(
        users.map((row) => [
          row.id,
          {
            full_name: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
            email: row.email,
            phone: row.phone,
          },
        ])
      );

      const mappedRows = bookings
        .map((row) => {
          const meta = (row.meta as Record<string, unknown> | undefined) ?? {};
          const packageId = String(meta.package_id ?? "");
          const packageInfo = packageId ? packageMap.get(packageId) : null;
          const memberInfo = userMap.get(row.member_id);
          const trainerInfo = userMap.get(row.trainer_id);
          const sessionInfo = row.session_id ? sessionMap.get(String(row.session_id)) : null;
          const metaLesson = AdminBookingsController.normalizeLessonCategory(meta.lesson_category);
          const ruleLesson = AdminBookingsController.normalizeLessonCategory(
            (packageInfo?.rules as Record<string, unknown> | undefined)?.lesson_category
          );
          const lessonCategory = sessionInfo?.lesson_category ?? metaLesson ?? ruleLesson ?? null;

          return {
            ...row,
            member_full_name: memberInfo?.full_name || null,
            member_email: memberInfo?.email || null,
            member_phone: memberInfo?.phone || null,
            trainer_full_name: trainerInfo?.full_name || null,
            trainer_email: trainerInfo?.email || null,
            trainer_phone: trainerInfo?.phone || null,
            session_title: sessionInfo?.title || null,
            session_type: sessionInfo?.type || null,
            lesson_category: lessonCategory,
            lesson_category_label: AdminBookingsController.lessonCategoryLabel(lessonCategory),
            package_title:
              (typeof meta.package_title === "string" && meta.package_title) || packageInfo?.title || null,
            package_display_price:
              (typeof meta.package_display_price === "string" && meta.package_display_price) ||
              packageInfo?.display_price ||
              null,
          };
        })
        .filter((row) => {
          if (!memberQuery) return true;
          const haystack = [
            row.member_full_name,
            row.member_email,
            row.member_phone,
            row.member_id,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("tr");
          return haystack.includes(memberQuery);
        });

      return res.json({ data: mappedRows });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin booking listesini getirirken hata oluştu:", error);
      throw new AppError("ADMIN_BOOKINGS_LIST_ERROR", 500, "Admin booking listesi getirilirken sunucu hatası oluştu");
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    // --- POST /api/admin/bookings ---
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
          throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const { member_id, trainer_id, starts_at, ends_at, status, meta, session_id } = req.body; 

      if (!member_id || !trainer_id || !starts_at || !ends_at)  {
        throw new AppError("VALIDATION_ERROR", 400, "member_id, trainer_id, starts_at ve ends_at alanları zorunludur");
      }

      const bookingRepostiry = AppDataSource.getRepository(Booking);
      const booking = new Booking();

      booking.tenant_id = tenantId;
      booking.member_id = member_id;
      booking.session_id = session_id;
      booking.trainer_id = trainer_id;
      booking.starts_at = AdminBookingsController.parseDate(starts_at, "starts_at");
      booking.ends_at = AdminBookingsController.parseDate(ends_at, "ends_at");
      if (status !== undefined) {
        AdminBookingsController.validateStatus(status);
        booking.status = status;
      } else {
        booking.status = BookingStatus.PENDING;
      }
      booking.payment_status = BookingPaymentStatus.REQUESTED;
      booking.payment_requested_at = new Date();
      booking.meta = meta ?? {};

      if (booking.ends_at <= booking.starts_at) {
        throw new AppError("VALIDATION_ERROR", 400, "ends_at, starts_at'dan sonra olmalıdır");
      }
      
      await bookingRepostiry.save(booking);
      await AdminBookingsController.logBookingAudit(req, {
        eventType: "ADMIN_BOOKING_CREATED",
        booking,
      });
      return res.status(201).json({ data: booking });
  } catch (error) {
      if (error instanceof AppError) {
        throw error;
    }
      console.error("Admin booking oluştururken hata oluştu:", error);
      throw new AppError("ADMIN_BOOKING_CREATE_ERROR", 500, "Admin booking oluşturulurken sunucu hatası oluştu");
  }
}

  static async getById(req: AuthenticatedRequest, res: Response) {
    // --- GET /api/admin/bookings/:id ---
    try {
      const tenantId = req.tenantId;
      const bookingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!tenantId) {
          throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const booking = await AppDataSource.getRepository(Booking).findOne({
        where: { tenant_id: tenantId, id: bookingId },
      });
      if (!booking) {
        throw new AppError("BOOKING_NOT_FOUND", 404, "Booking bulunamadı");
      }
      const oldState = {
        member_id: booking.member_id,
        trainer_id: booking.trainer_id,
        starts_at: booking.starts_at.toISOString(),
        ends_at: booking.ends_at.toISOString(),
        status: booking.status,
      };
      return res.json({ data: booking });

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
    }
      console.error("Admin booking id getirilirken hata oluştu:", error);
      throw new AppError("ADMIN_BOOKING_GET_ID_ERROR", 500, "Admin booking id getirilirken sunucu hatası oluştu");
  }
}

  static async update(req: AuthenticatedRequest, res: Response) {
    // --- PUT /api/admin/bookings/:id ---
    try {
      const tenantId = req.tenantId;
      const bookingId = String(req.params.id ?? "");
      if (!tenantId) {
          throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const bookingRepo = AppDataSource.getRepository(Booking);
      const booking = await bookingRepo.findOne({
        where: { tenant_id: tenantId, id: bookingId },
      });
      if (!booking) {
        throw new AppError("BOOKING_NOT_FOUND", 404, "Booking bulunamadı");
      }
      const oldState = {
        member_id: booking.member_id,
        trainer_id: booking.trainer_id,
        starts_at: booking.starts_at.toISOString(),
        ends_at: booking.ends_at.toISOString(),
        status: booking.status,
        payment_note: booking.payment_note ?? null,
      };

      const { member_id, trainer_id, starts_at, ends_at, status, meta, payment_note } = req.body;
      
      if (member_id) booking.member_id = member_id;
      if (trainer_id) booking.trainer_id = trainer_id;
      if (starts_at !== undefined) booking.starts_at = AdminBookingsController.parseDate(starts_at, "starts_at");
      if (ends_at !== undefined) booking.ends_at = AdminBookingsController.parseDate(ends_at, "ends_at");
      if (status !== undefined) {
        AdminBookingsController.validateStatus(status);
        booking.status = status;
      }
      if (meta !== undefined) booking.meta = meta ?? {};
      if (payment_note !== undefined) booking.payment_note = String(payment_note ?? "").slice(0, 500);

      if (booking.ends_at <= booking.starts_at) {
        throw new AppError("VALIDATION_ERROR", 400, "ends_at, starts_at'dan sonra olmalıdır");
      }

      await bookingRepo.save(booking);
      await AdminBookingsController.logBookingAudit(req, {
        eventType: "ADMIN_BOOKING_UPDATED",
        booking,
        oldState,
      });
      return res.json({ data: booking });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin booking güncellenirken hata oluştu:", error);
      throw new AppError("ADMIN_BOOKING_UPDATE_ERROR", 500, "Admin booking güncellenirken sunucu hatası oluştu");
  }
}

  static async setStatus(req: AuthenticatedRequest, res: Response) {
    // --- PATCH /api/admin/bookings/:id/status ---
    try {
      const tenantId = req.tenantId;
      const bookingId = String(req.params.id ?? "");
      if (!tenantId) {
          throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      const bookingRepo = AppDataSource.getRepository(Booking);
      const booking = await bookingRepo.findOne({
        where: { tenant_id: tenantId, id: bookingId },
      });
      if (!booking) {
        throw new AppError("BOOKING_NOT_FOUND", 404, "Booking bulunamadı");
      }
      const oldState = {
        status: booking.status,
      };
      
      const { status } = req.body;
      if (typeof status !== "string") {
        throw new AppError("VALIDATION_ERROR", 400, "status alanı zorunludur");
      }
      AdminBookingsController.validateStatus(status);
      booking.status = status;


      await bookingRepo.save(booking);
      await AdminBookingsController.logBookingAudit(req, {
        eventType: "ADMIN_BOOKING_STATUS_CHANGED",
        booking,
        oldState,
      });
      return res.json({ data: booking });
    }
    catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin booking durum güncellenirken hata oluştu:", error);
      throw new AppError("ADMIN_BOOKING_SET_STATUS_ERROR", 500, "Admin booking durum güncellenirken sunucu hatası oluştu");
    }
  }

  // --- PATCH /api/admin/bookings/:id/reschedule ---
  static async reschedule(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const bookingId = String(req.params.id ?? "");
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const bookingRepo = AppDataSource.getRepository(Booking);
      const booking = await bookingRepo.findOne({
        where: { tenant_id: tenantId, id: bookingId },
      });
      if (!booking) {
        throw new AppError("BOOKING_NOT_FOUND", 404, "Booking bulunamadı");
      }
      const oldState = {
        member_id: booking.member_id,
        trainer_id: booking.trainer_id,
        starts_at: booking.starts_at.toISOString(),
        ends_at: booking.ends_at.toISOString(),
        status: booking.status,
      };

      const startsAt = req.body?.starts_at !== undefined
        ? AdminBookingsController.parseDate(req.body.starts_at, "starts_at")
        : booking.starts_at;
      const endsAt = req.body?.ends_at !== undefined
        ? AdminBookingsController.parseDate(req.body.ends_at, "ends_at")
        : booking.ends_at;
      if (endsAt <= startsAt) {
        throw new AppError("VALIDATION_ERROR", 400, "ends_at, starts_at'dan sonra olmalıdır");
      }

      const status = req.body?.status ?? BookingStatus.RESCHEDULED;
      AdminBookingsController.validateStatus(status);

      const existingMeta =
        booking.meta && typeof booking.meta === "object" && !Array.isArray(booking.meta)
          ? (booking.meta as Record<string, unknown>)
          : {};
      const incomingMeta =
        req.body?.meta && typeof req.body.meta === "object" && !Array.isArray(req.body.meta)
          ? (req.body.meta as Record<string, unknown>)
          : {};
      const mergedMeta = {
        ...existingMeta,
        ...incomingMeta,
      };

      const history = Array.isArray(mergedMeta.reschedule_history)
        ? [...(mergedMeta.reschedule_history as Array<Record<string, unknown>>)]
        : [];
      history.push({
        changed_by: "ADMIN",
        changed_at: new Date().toISOString(),
        from_starts_at: booking.starts_at.toISOString(),
        from_ends_at: booking.ends_at.toISOString(),
        to_starts_at: startsAt.toISOString(),
        to_ends_at: endsAt.toISOString(),
        from_trainer_id: booking.trainer_id,
        to_trainer_id: req.body?.trainer_id ?? booking.trainer_id,
        from_member_id: booking.member_id,
        to_member_id: req.body?.member_id ?? booking.member_id,
      });
      mergedMeta.reschedule_history = history;

      booking.starts_at = startsAt;
      booking.ends_at = endsAt;
      booking.status = status;
      booking.meta = mergedMeta;
      if (req.body?.trainer_id) booking.trainer_id = String(req.body.trainer_id);
      if (req.body?.member_id) booking.member_id = String(req.body.member_id);
      if (req.body?.session_id !== undefined) {
        booking.session_id = req.body.session_id ? String(req.body.session_id) : undefined;
      }

      await bookingRepo.save(booking);
      await AdminBookingsController.logBookingAudit(req, {
        eventType: "ADMIN_BOOKING_RESCHEDULED",
        booking,
        oldState,
      });
      return res.json({ data: booking });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin booking reschedule error:", error);
      throw new AppError("ADMIN_BOOKING_RESCHEDULE_ERROR", 500, "Admin booking yeniden planlanırken sunucu hatası oluştu");
    }
  }
}
