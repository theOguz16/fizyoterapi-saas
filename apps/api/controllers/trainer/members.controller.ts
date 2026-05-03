// Bu controller trainer tarafindaki members.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Attendance } from "../../entities/attendance.entity";
import { Booking } from "../../entities/booking.entity";
import { ClassSession } from "../../entities/class-session.entity";
import { Measurement } from "../../entities/measurement.entity";
import { ReferralReward } from "../../entities/referral-reward.entity";
import { Package } from "../../entities/package.entity";
import { PackageTrainerAssignment } from "../../entities/package-trainer-assignment.entity";
import { TrainerMemberNote } from "../../entities/trainer-member-note.entity";
import { TrainerMemberNoteHistory } from "../../entities/trainer-member-note-history.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { User, UserRole } from "../../entities/user.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AuditLogService } from "../../services/audit-log.service";
import { SalonMembership } from "../../entities/salon-membership.entity";
import { Account } from "../../entities/account.entity";

type StructuredTrainerNoteCategory = "GENERAL" | "GOAL" | "RISK" | "FOLLOW_UP";

type StructuredTrainerNote = {
  title?: string | null;
  body: string;
  category: StructuredTrainerNoteCategory;
};

export class TrainerMembersController {
  private static readonly STRUCTURED_NOTE_PREFIX = "__structured_note_v1__:";
  private static readonly UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private static async logNoteAudit(
    req: AuthenticatedRequest,
    input: {
      eventType: string;
      memberId: string;
      noteId: string;
      category?: string | null;
      title?: string | null;
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
      target_type: "trainer_member_note",
      target_id: input.noteId,
      metadata: {
        member_id: input.memberId,
        note_id: input.noteId,
        category: input.category ?? null,
        title: input.title ?? null,
      },
    });
  }

  private static async ensureMember(tenantId: string, memberId: string) {
    if (!TrainerMembersController.UUID_PATTERN.test(memberId)) {
      throw new AppError("VALIDATION_ERROR", 400, "Gecersiz uye kimligi");
    }

    const member = await AppDataSource.getRepository(User).findOne({
      where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
    });
    if (!member) {
      throw new AppError("MEMBER_NOT_FOUND", 404, "Uye bulunamadi");
    }
    return member;
  }

  private static normalizeNoteCategory(value: unknown): StructuredTrainerNoteCategory {
    const category = String(value ?? "GENERAL").trim().toUpperCase();
    if (category === "GOAL" || category === "RISK" || category === "FOLLOW_UP") {
      return category;
    }
    return "GENERAL";
  }

  private static decodeNotePayload(value: unknown): StructuredTrainerNote {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) {
      return {
        title: null,
        body: "",
        category: "GENERAL",
      };
    }

    if (!raw.startsWith(TrainerMembersController.STRUCTURED_NOTE_PREFIX)) {
      return {
        title: null,
        body: raw,
        category: "GENERAL",
      };
    }

    try {
      const decoded = JSON.parse(raw.slice(TrainerMembersController.STRUCTURED_NOTE_PREFIX.length)) as Record<string, unknown>;
      const body = String(decoded.body ?? "").trim();
      return {
        title: typeof decoded.title === "string" && decoded.title.trim() ? decoded.title.trim() : null,
        body,
        category: TrainerMembersController.normalizeNoteCategory(decoded.category),
      };
    } catch {
      return {
        title: null,
        body: raw,
        category: "GENERAL",
      };
    }
  }

  private static encodeNotePayload(note: StructuredTrainerNote) {
    return `${TrainerMembersController.STRUCTURED_NOTE_PREFIX}${JSON.stringify({
      title: note.title ?? null,
      body: note.body,
      category: note.category,
    })}`;
  }

  private static normalizeNoteInput(value: unknown): StructuredTrainerNote {
    if (typeof value === "string") {
      const body = value.trim();
      if (!body) {
        throw new AppError("VALIDATION_ERROR", 400, "note bos olamaz");
      }
      if (body.length > 5000) {
        throw new AppError("VALIDATION_ERROR", 400, "note en fazla 5000 karakter olabilir");
      }
      return {
        title: null,
        body,
        category: "GENERAL",
      };
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new AppError("VALIDATION_ERROR", 400, "note metin veya obje olmalidir");
    }

    const payload = value as Record<string, unknown>;
    const body = String(payload.body ?? payload.note ?? "").trim();
    const title = String(payload.title ?? "").trim();
    if (!body) {
      throw new AppError("VALIDATION_ERROR", 400, "note bos olamaz");
    }
    if (body.length > 5000) {
      throw new AppError("VALIDATION_ERROR", 400, "note en fazla 5000 karakter olabilir");
    }
    if (title.length > 120) {
      throw new AppError("VALIDATION_ERROR", 400, "title en fazla 120 karakter olabilir");
    }

    return {
      title: title || null,
      body,
      category: TrainerMembersController.normalizeNoteCategory(payload.category),
    };
  }

  private static mapStructuredNoteRow(row: TrainerMemberNoteHistory) {
    const parsed = TrainerMembersController.decodeNotePayload(row.note);
    return {
      id: row.id,
      title: parsed.title ?? null,
      body: parsed.body,
      note: parsed.body,
      category: parsed.category,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private static async ensureLegacyNoteMigrated(tenantId: string, trainerId: string, memberId: string) {
    const noteRepo = AppDataSource.getRepository(TrainerMemberNote);
    const historyRepo = AppDataSource.getRepository(TrainerMemberNoteHistory);

    const [currentRow, historyCount] = await Promise.all([
      noteRepo.findOne({
        where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId },
      }),
      historyRepo.count({
        where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId },
      }),
    ]);

    const legacyNote = currentRow?.note?.trim() || "";
    if (legacyNote && historyCount === 0) {
      await historyRepo.save(
        historyRepo.create({
          tenant_id: tenantId,
          trainer_id: trainerId,
          member_id: memberId,
          note: legacyNote,
        })
      );
    }
  }

  private static async syncCurrentNoteSummary(tenantId: string, trainerId: string, memberId: string) {
    const noteRepo = AppDataSource.getRepository(TrainerMemberNote);
    const historyRepo = AppDataSource.getRepository(TrainerMemberNoteHistory);

    const [currentRow, latestHistoryRow] = await Promise.all([
      noteRepo.findOne({
        where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId },
      }),
      historyRepo.findOne({
        where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId },
        order: { updated_at: "DESC", created_at: "DESC" },
      }),
    ]);

    if (!latestHistoryRow) {
      if (currentRow) {
        await noteRepo.remove(currentRow);
      }
      return null;
    }

    if (!currentRow) {
      const latestBody = TrainerMembersController.decodeNotePayload(latestHistoryRow.note).body;
      const created = noteRepo.create({
        tenant_id: tenantId,
        trainer_id: trainerId,
        member_id: memberId,
        note: latestBody,
      });
      await noteRepo.save(created);
      return latestHistoryRow;
    }

    const latestBody = TrainerMembersController.decodeNotePayload(latestHistoryRow.note).body;
    if (currentRow.note !== latestBody) {
      currentRow.note = latestBody;
      await noteRepo.save(currentRow);
    }

    return latestHistoryRow;
  }

  private static async listNoteItems(tenantId: string, trainerId: string, memberId: string) {
    await TrainerMembersController.ensureLegacyNoteMigrated(tenantId, trainerId, memberId);
    const rows = await AppDataSource.getRepository(TrainerMemberNoteHistory).find({
      where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId },
      order: { updated_at: "DESC", created_at: "DESC" },
      take: 50,
    });

    await TrainerMembersController.syncCurrentNoteSummary(tenantId, trainerId, memberId);

    return rows.map((row) => TrainerMembersController.mapStructuredNoteRow(row));
  }

  // --- GET /api/trainer/members ---
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const [bookingRows, attendanceRows, measurementRows] = await Promise.all([
        AppDataSource.getRepository(Booking)
          .createQueryBuilder("b")
          .select("DISTINCT b.member_id", "member_id")
          .where("b.tenant_id = :tenantId", { tenantId })
          .andWhere("b.trainer_id = :trainerId", { trainerId })
          .getRawMany<{ member_id: string }>(),
        AppDataSource.getRepository(Attendance)
          .createQueryBuilder("a")
          .select("DISTINCT a.member_id", "member_id")
          .where("a.tenant_id = :tenantId", { tenantId })
          .andWhere("a.trainer_id = :trainerId", { trainerId })
          .getRawMany<{ member_id: string }>(),
        AppDataSource.getRepository(Measurement)
          .createQueryBuilder("m")
          .select("DISTINCT m.member_id", "member_id")
          .where("m.tenant_id = :tenantId", { tenantId })
          .andWhere("m.trainer_id = :trainerId", { trainerId })
          .getRawMany<{ member_id: string }>(),
      ]);

      const memberIds = new Set<string>();
      for (const row of bookingRows) memberIds.add(row.member_id);
      for (const row of attendanceRows) memberIds.add(row.member_id);
      for (const row of measurementRows) memberIds.add(row.member_id);

      if (memberIds.size === 0) {
        return res.json({ data: [] });
      }

      const ids = Array.from(memberIds);
      const members = await AppDataSource.getRepository(User)
        .createQueryBuilder("u")
        .where("u.tenant_id = :tenantId", { tenantId })
        .andWhere("u.role = :role", { role: UserRole.MEMBER })
        .andWhere("u.id IN (:...ids)", { ids })
        .orderBy("u.first_name", "ASC")
        .addOrderBy("u.last_name", "ASC")
        .getMany();

      return res.json({
        data: members.map((member) => ({
          id: member.id,
          full_name: `${member.first_name} ${member.last_name}`.trim(),
          email: member.email,
          phone: member.phone,
          is_active: member.is_active,
          qr_code: member.qr_code ?? null,
        })),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer members list error:", error);
      throw new AppError("TRAINER_MEMBERS_LIST_ERROR", 500, "Uye listesi getirilemedi");
    }
  }

  // --- GET /api/trainer/members/:id ---
  static async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      const memberId = String(req.params.id ?? "");
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }

      const member = await TrainerMembersController.ensureMember(tenantId, memberId);

      const [bookingCount, checkinCount, latestMeasurement, packageRows, rewardRows, trendRows, membership] = await Promise.all([
        AppDataSource.getRepository(Booking).count({
          where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId },
        }),
        AppDataSource.getRepository(Attendance).count({
          where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId },
        }),
        AppDataSource.getRepository(Measurement).findOne({
          where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId },
          order: { measured_at: "DESC" },
        }),
        AppDataSource.getRepository(UserPackage).find({
          where: { tenant_id: tenantId, user_id: memberId },
          order: { created_at: "DESC" },
          take: 12,
        }),
        AppDataSource.getRepository(ReferralReward).find({
          where: { tenant_id: tenantId, member_id: memberId },
          order: { created_at: "DESC" },
          take: 12,
        }),
        AppDataSource.getRepository(Attendance)
          .createQueryBuilder("a")
          .where("a.tenant_id = :tenantId", { tenantId })
          .andWhere("a.member_id = :memberId", { memberId })
          .andWhere("a.trainer_id = :trainerId", { trainerId })
          .andWhere("a.created_at >= :since", {
            since: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90),
          })
          .orderBy("a.created_at", "ASC")
          .getMany(),
        AppDataSource.getRepository(SalonMembership).findOne({
          where: { tenant_id: tenantId, user_id: memberId, role: UserRole.MEMBER },
          order: { created_at: "DESC" },
        }),
      ]);
      const account = membership?.account_id ? await AppDataSource.getRepository(Account).findOne({ where: { id: membership.account_id } }) : null;

      const packageIds = Array.from(new Set(packageRows.map((row) => row.package_id).filter(Boolean)));
      const packages = packageIds.length
        ? await AppDataSource.getRepository(Package).find({
            where: packageIds.map((id) => ({ tenant_id: tenantId, id })),
          })
        : [];
      const packageMap = new Map(packages.map((pkg) => [pkg.id, pkg]));

      const assignments = packageIds.length
        ? await AppDataSource.getRepository(PackageTrainerAssignment).find({
            where: packageIds.map((packageId) => ({ tenant_id: tenantId, package_id: packageId, is_active: true })),
          })
        : [];
      const trainerIds = Array.from(new Set(assignments.map((row) => row.trainer_id).filter(Boolean)));
      const trainers = trainerIds.length
        ? await AppDataSource.getRepository(User).find({
            where: trainerIds.map((id) => ({ tenant_id: tenantId, id, role: UserRole.TRAINER })),
            select: ["id", "first_name", "last_name", "email"],
          })
        : [];
      const trainerMap = new Map(
        trainers.map((trainer) => [
          trainer.id,
          {
            id: trainer.id,
            full_name: `${trainer.first_name || ""} ${trainer.last_name || ""}`.trim() || trainer.email,
            email: trainer.email,
          },
        ])
      );
      const assignmentsByPackage = new Map<
        string,
        Array<{ id: string; full_name: string; email: string }>
      >();
      for (const assignment of assignments) {
        const trainer = trainerMap.get(assignment.trainer_id);
        if (!trainer) continue;
        assignmentsByPackage.set(assignment.package_id, [
          ...(assignmentsByPackage.get(assignment.package_id) || []),
          trainer,
        ]);
      }

      const now = Date.now();
      const packageSummary = packageRows.map((row) => {
        const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : null;
        const isExpired = typeof expiresAt === "number" ? expiresAt < now : false;
        const pkg = packageMap.get(row.package_id);
        const assignedTrainers = assignmentsByPackage.get(row.package_id) || [];
        return {
          user_package_id: row.id,
          package_id: row.package_id,
          package_title: pkg?.title ?? null,
          package_type: pkg?.type ?? null,
          package_total_credits: pkg?.total_credits ?? null,
          package_duration_days: pkg?.duration_days ?? null,
          package_price: pkg?.display_price ? Number(pkg.display_price) : null,
          package_rules: pkg?.rules ?? null,
          remaining_credits: row.remaining_credits,
          is_active: row.is_active,
          starts_at: row.starts_at ?? null,
          expires_at: row.expires_at ?? null,
          is_expired: isExpired,
          assigned_trainers: assignedTrainers,
          trainer_summary: assignedTrainers.length
            ? assignedTrainers.map((trainer) => trainer.full_name).join(", ")
            : null,
        };
      });

      const weeklyMap = new Map<string, number>();
      for (const row of trendRows) {
        const dt = new Date(row.created_at);
        const weekStart = new Date(dt);
        const day = weekStart.getDay() || 7;
        weekStart.setDate(weekStart.getDate() - day + 1);
        weekStart.setHours(0, 0, 0, 0);
        const key = weekStart.toISOString().slice(0, 10);
        weeklyMap.set(key, (weeklyMap.get(key) || 0) + 1);
      }
      const attendanceTrend = Array.from(weeklyMap.entries()).map(([week_start, count]) => ({
        week_start,
        count,
      }));

      return res.json({
        data: {
          id: member.id,
          full_name: `${member.first_name} ${member.last_name}`.trim(),
          email: member.email,
          phone: member.phone,
          is_active: member.is_active,
          onboarding_profile: account?.onboarding_profile || null,
          qr_code: member.qr_code ?? null,
          stats: {
            booking_count: bookingCount,
            checkin_count: checkinCount,
            latest_measured_at: latestMeasurement?.measured_at ?? null,
          },
          package_summary: packageSummary,
          campaign_rewards: rewardRows.map((row) => ({
            id: row.id,
            credits_granted: row.credits_granted,
            rule_name: row.rule_name,
            granted_at: row.granted_at,
          })),
          attendance_trend: attendanceTrend,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer member getById error:", error);
      throw new AppError("TRAINER_MEMBERS_GET_ERROR", 500, "Uye detayi getirilemedi");
    }
  }

  // --- GET /api/trainer/members/:id/attendance ---
  static async getAttendanceHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      const memberId = String(req.params.id ?? "");
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }
      await TrainerMembersController.ensureMember(tenantId, memberId);

      const rawLimit = req.query.limit ? Number(req.query.limit) : 50;
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 200) : 50;

      const rows = await AppDataSource.getRepository(Attendance).find({
        where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId },
        order: { created_at: "DESC" },
        take: limit,
      });
      const sessionIds = Array.from(new Set(rows.map((row) => row.session_id).filter(Boolean)));
      const sessions = sessionIds.length
        ? await AppDataSource.getRepository(ClassSession).find({
            where: sessionIds.map((id) => ({ tenant_id: tenantId, id: String(id) })),
            select: ["id", "title", "type", "lesson_category"],
          })
        : [];
      const sessionMap = new Map(sessions.map((row) => [row.id, row]));

      return res.json({
        data: rows.map((row) => ({
          ...row,
          session_title: row.session_id ? sessionMap.get(String(row.session_id))?.title ?? null : null,
          session_type: row.session_id ? sessionMap.get(String(row.session_id))?.type ?? null : null,
          lesson_category: row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null,
        })),
        limit,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer member attendance error:", error);
      throw new AppError("TRAINER_MEMBERS_ATTENDANCE_ERROR", 500, "Uye attendance gecmisi getirilemedi");
    }
  }

  // --- GET /api/trainer/members/:id/measurements ---
  static async getMeasurements(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      const memberId = String(req.params.id ?? "");
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }
      await TrainerMembersController.ensureMember(tenantId, memberId);

      const rawLimit = req.query.limit ? Number(req.query.limit) : 50;
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 200) : 50;

      const rows = await AppDataSource.getRepository(Measurement).find({
        where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId },
        order: { measured_at: "DESC" },
        take: limit,
      });
      return res.json({ data: rows, limit });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer member measurements error:", error);
      throw new AppError("TRAINER_MEMBERS_MEASUREMENTS_ERROR", 500, "Uye olcum gecmisi getirilemedi");
    }
  }

  // --- GET /api/trainer/members/:id/notes ---
  static async getNotes(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      const memberId = String(req.params.id ?? "");
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }
      await TrainerMembersController.ensureMember(tenantId, memberId);

      const items = await TrainerMembersController.listNoteItems(tenantId, trainerId, memberId);
      const latest = items[0] || null;

      return res.json({
        data: {
          member_id: memberId,
          note: latest?.body ?? "",
          title: latest?.title ?? null,
          body: latest?.body ?? "",
          category: latest?.category ?? "GENERAL",
          updated_at: latest?.updated_at ?? null,
          items,
          count: items.length,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer member notes get error:", error);
      throw new AppError("TRAINER_MEMBERS_NOTES_GET_ERROR", 500, "Uye notu getirilemedi");
    }
  }

  // --- GET /api/trainer/members/:id/notes/history ---
  static async getNoteHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      const memberId = String(req.params.id ?? "");
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }
      await TrainerMembersController.ensureMember(tenantId, memberId);

      const items = await TrainerMembersController.listNoteItems(tenantId, trainerId, memberId);

      return res.json({
        data: items,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer member notes history get error:", error);
      throw new AppError("TRAINER_MEMBERS_NOTES_HISTORY_GET_ERROR", 500, "Uye not gecmisi getirilemedi");
    }
  }

  // --- PUT /api/trainer/members/:id/notes ---
  static async updateNotes(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      const memberId = String(req.params.id ?? "");
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }
      await TrainerMembersController.ensureMember(tenantId, memberId);

      const historyRepo = AppDataSource.getRepository(TrainerMemberNoteHistory);
      const note = TrainerMembersController.normalizeNoteInput(req.body?.note ?? req.body);

      const saved = await historyRepo.save(
        historyRepo.create({
          tenant_id: tenantId,
          trainer_id: trainerId,
          member_id: memberId,
          note: TrainerMembersController.encodeNotePayload(note),
        })
      );
      const latest = await TrainerMembersController.syncCurrentNoteSummary(tenantId, trainerId, memberId);
      await TrainerMembersController.logNoteAudit(req, {
        eventType: "TRAINER_MEMBER_NOTE_CREATED",
        memberId,
        noteId: saved.id,
        category: note.category,
        title: note.title ?? null,
      });
      return res.json({
        data: {
          member_id: memberId,
          note: note.body,
          title: note.title ?? null,
          body: note.body,
          category: note.category,
          updated_at: latest?.updated_at ?? null,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer member notes update error:", error);
      throw new AppError("TRAINER_MEMBERS_NOTES_UPDATE_ERROR", 500, "Uye notu guncellenemedi");
    }
  }

  // --- POST /api/trainer/members/:id/notes ---
  static async createNote(req: AuthenticatedRequest, res: Response) {
    return TrainerMembersController.updateNotes(req, res);
  }

  // --- PATCH /api/trainer/members/:id/notes/:noteId ---
  static async updateNoteById(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      const memberId = String(req.params.id ?? "");
      const noteId = String(req.params.noteId ?? "");
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }
      await TrainerMembersController.ensureMember(tenantId, memberId);

      const note = TrainerMembersController.normalizeNoteInput(req.body?.note ?? req.body);
      const historyRepo = AppDataSource.getRepository(TrainerMemberNoteHistory);
      const row = await historyRepo.findOne({
        where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId, id: noteId },
      });
      if (!row) {
        throw new AppError("NOTE_NOT_FOUND", 404, "Not bulunamadi");
      }

      row.note = TrainerMembersController.encodeNotePayload(note);
      await historyRepo.save(row);
      await TrainerMembersController.syncCurrentNoteSummary(tenantId, trainerId, memberId);
      await TrainerMembersController.logNoteAudit(req, {
        eventType: "TRAINER_MEMBER_NOTE_UPDATED",
        memberId,
        noteId: row.id,
        category: note.category,
        title: note.title ?? null,
      });

      return res.json({
        data: {
          id: row.id,
          title: note.title ?? null,
          body: note.body,
          note: note.body,
          category: note.category,
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer member note patch error:", error);
      throw new AppError("TRAINER_MEMBERS_NOTE_PATCH_ERROR", 500, "Uye notu guncellenemedi");
    }
  }

  // --- DELETE /api/trainer/members/:id/notes/:noteId ---
  static async deleteNoteById(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      const memberId = String(req.params.id ?? "");
      const noteId = String(req.params.noteId ?? "");
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
      }
      await TrainerMembersController.ensureMember(tenantId, memberId);

      const historyRepo = AppDataSource.getRepository(TrainerMemberNoteHistory);
      const row = await historyRepo.findOne({
        where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId, id: noteId },
      });
      if (!row) {
        throw new AppError("NOTE_NOT_FOUND", 404, "Not bulunamadi");
      }

      await historyRepo.remove(row);
      await TrainerMembersController.syncCurrentNoteSummary(tenantId, trainerId, memberId);
      await TrainerMembersController.logNoteAudit(req, {
        eventType: "TRAINER_MEMBER_NOTE_DELETED",
        memberId,
        noteId,
      });

      return res.json({
        data: {
          id: noteId,
          deleted: true,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer member note delete error:", error);
      throw new AppError("TRAINER_MEMBERS_NOTE_DELETE_ERROR", 500, "Uye notu silinemedi");
    }
  }
}
