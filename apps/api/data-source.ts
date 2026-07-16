// TypeORM veritabani baglanti tanimi ve entity kayit listesi bu dosyada tutulur.
// Repository kullanabilmek icin uygulama baslangicinda bu kaynak initialize edilir.
import "reflect-metadata";
import { DataSource } from "typeorm";
import { Tenant } from "./entities/tenant.entity";
import { User } from "./entities/user.entity";
import { Package } from "./entities/package.entity";
import { UserPackage } from "./entities/user-package.entity";
import { ClassSession } from "./entities/class-session.entity";
import { Attendance } from "./entities/attendance.entity";
import { Availability } from "./entities/availability.entity";
import { Booking } from "./entities/booking.entity";
import { Measurement } from "./entities/measurement.entity";
import { RetentionScore } from "./entities/retention-score.entity";
import { Referral } from "./entities/referral.entity";
import { ReferralReward } from "./entities/referral-reward.entity";
import { SalonProfile } from "./entities/salon-profile.entity";
import { SalonImage } from "./entities/salon-image.entity";
import { Lead } from "./entities/lead.entity";
import { NotificationTemplate } from "./entities/notification-template.entity";
import { TrainerMemberNote } from "./entities/trainer-member-note.entity";
import { TrainerMemberNoteHistory } from "./entities/trainer-member-note-history.entity";
import { Invite } from "./entities/invite.entity";
import { NotificationEvent } from "./entities/notification-event.entity";
import { NotificationDelivery } from "./entities/notification-delivery.entity";
import { DeviceToken } from "./entities/device-token.entity";
import { MemberCreditWallet } from "./entities/member-credit-wallet.entity";
import { CreditLedger } from "./entities/credit-ledger.entity";
import { TrainerSkill } from "./entities/trainer-skill.entity";
import { PackageTrainerAssignment } from "./entities/package-trainer-assignment.entity";
import { Account } from "./entities/account.entity";
import { SalonMembership } from "./entities/salon-membership.entity";
import { SalonApplication } from "./entities/salon-application.entity";
import { AuditLog } from "./entities/audit-log.entity";
import { BackgroundJob } from "./entities/background-job.entity";
import { Campaign } from "./entities/campaign.entity";
import { ProductDemoLead } from "./entities/product-demo-lead.entity";

// TypeORM icin merkezi veritabani baglanti tanimi.
// Yeni entity eklendiginde hem runtime hem test senaryolari icin burada listelenmesi gerekir.
export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: process.env.DB_SYNC === "true",
  logging: false,
  entities: [
    Tenant, User, Package, UserPackage, ClassSession, Attendance,
    Availability, Booking, Measurement, RetentionScore,
    Referral, ReferralReward, SalonProfile, SalonImage, Lead, NotificationTemplate, TrainerMemberNote, TrainerMemberNoteHistory,
    Invite, NotificationEvent, NotificationDelivery, DeviceToken, MemberCreditWallet, CreditLedger, TrainerSkill,
    PackageTrainerAssignment, Account, SalonMembership, SalonApplication, AuditLog, BackgroundJob, Campaign,
    ProductDemoLead
  ],
  // migrations: ["src/migrations/*.ts"],
});
