import { In } from "typeorm";
import { AppDataSource } from "../data-source";
import { Attendance, AttendanceResult } from "../entities/attendance.entity";
import { Booking, BookingPaymentStatus, BookingStatus } from "../entities/booking.entity";
import { ClassSession, SessionStatus } from "../entities/class-session.entity";
import { UserPackage } from "../entities/user-package.entity";

const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
  BookingStatus.RESCHEDULED,
];

export class GroupClassCancellationService {
  static async cancelSession(input: {
    tenantId: string;
    sessionId: string;
    canceledBy: "TRAINER" | "ADMIN" | "MEMBER" | "SYSTEM";
    reason: string;
    cancelSession?: boolean;
  }) {
    const { tenantId, sessionId, canceledBy, reason, cancelSession = true } = input;

    return AppDataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(ClassSession);
      const bookingRepo = manager.getRepository(Booking);
      const attendanceRepo = manager.getRepository(Attendance);
      const userPackageRepo = manager.getRepository(UserPackage);

      const nowIso = new Date().toISOString();

      const session = await sessionRepo.findOne({
        where: {
          tenant_id: tenantId,
          id: sessionId,
        },
      });

      if (cancelSession && session && session.status !== SessionStatus.CANCELED) {
        session.status = SessionStatus.CANCELED;
        session.meta = {
          ...(session.meta || {}),
          cancellation: {
            canceled_by: canceledBy,
            canceled_at: nowIso,
            reason,
          },
        };

        await sessionRepo.save(session);
      }

      const bookings = await bookingRepo.find({
        where: {
          tenant_id: tenantId,
          session_id: sessionId,
          status: In(ACTIVE_BOOKING_STATUSES),
        } as any,
      });

      const bookingIds = bookings.map((booking) => booking.id).filter(Boolean);

      const refundableAttendances = bookingIds.length
        ? await attendanceRepo.find({
            where: {
              tenant_id: tenantId,
              booking_id: In(bookingIds),
              result: AttendanceResult.CREDIT_DEDUCTED,
            } as any,
          })
        : [];

      let refundedCreditCount = 0;
      const refundedAttendanceIds: string[] = [];

      for (const attendance of refundableAttendances) {
        const creditsDeducted = Number(attendance.credits_deducted || 0);
        const userPackageId = String(attendance.user_package_id || "").trim();

        if (creditsDeducted <= 0 || !userPackageId) continue;

        // Aynı attendance daha önce iade edildiyse tekrar hak ekleme.
        if (attendance.meta?.refund?.refunded_at) continue;

        const userPackage = await userPackageRepo.findOne({
          where: {
            tenant_id: tenantId,
            id: userPackageId,
            user_id: attendance.member_id,
          },
        });

        if (!userPackage) continue;

        userPackage.remaining_credits += creditsDeducted;

        attendance.meta = {
          ...(attendance.meta || {}),
          refund: {
            refunded_at: nowIso,
            reason,
            canceled_by: canceledBy,
            credits_refunded: creditsDeducted,
          },
        };

        await userPackageRepo.save(userPackage);
        await attendanceRepo.save(attendance);

        refundedCreditCount += creditsDeducted;
        refundedAttendanceIds.push(attendance.id);
      }

      for (const booking of bookings) {
        booking.status = BookingStatus.CANCELED;
        booking.payment_status = BookingPaymentStatus.REJECTED;
        booking.payment_note = reason;
        booking.meta = {
          ...(booking.meta || {}),
          cancellation: {
            canceled_by: canceledBy,
            canceled_at: nowIso,
            reason,
          },
        };
      }

      if (bookings.length > 0) {
        await bookingRepo.save(bookings);
      }

      return {
        session_id: sessionId,
        canceled_booking_count: bookings.length,
        refunded_credit_count: refundedCreditCount,
        refunded_attendance_count: refundedAttendanceIds.length,
        refunded_attendance_ids: refundedAttendanceIds,
      };
    });
  }
}