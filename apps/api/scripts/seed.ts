// Bu script operasyonel veya demo amacli seed gorevini calistirmak icin kullanilir.
// Uygulama runtime'ina dogrudan bagli olmayan bakim isleri bu dosyada tutulur.
import "dotenv/config";
import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { ScriptSafetyService } from "../services/script-safety.service";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { User, UserRole } from "../entities/user.entity";
import { ManagedGrowthStatus, SalonProfile } from "../entities/salon-profile.entity";
import { Package, PackageType } from "../entities/package.entity";
import { UserPackage } from "../entities/user-package.entity";
import { ClassSession, LessonCategory, SessionStatus, SessionType } from "../entities/class-session.entity";
import { Booking, BookingPaymentStatus, BookingStatus } from "../entities/booking.entity";
import { Attendance, AttendanceResult } from "../entities/attendance.entity";
import { Measurement } from "../entities/measurement.entity";
import { Availability } from "../entities/availability.entity";
import { Referral, ReferralStatus } from "../entities/referral.entity";
import { ReferralReward } from "../entities/referral-reward.entity";
import { MemberCreditWallet } from "../entities/member-credit-wallet.entity";
import { CreditLedger, CreditLedgerSource } from "../entities/credit-ledger.entity";
import { TrainerSkill } from "../entities/trainer-skill.entity";
import { PackageTrainerAssignment } from "../entities/package-trainer-assignment.entity";
import { Invite } from "../entities/invite.entity";
import { Lead, LeadStatus } from "../entities/lead.entity";
import { NotificationTemplate, NotificationType } from "../entities/notification-template.entity";
import { NotificationDelivery } from "../entities/notification-delivery.entity";
import { NotificationEvent } from "../entities/notification-event.entity";
import { DeviceToken } from "../entities/device-token.entity";
import { RetentionScore } from "../entities/retention-score.entity";
import { TrainerMemberNote } from "../entities/trainer-member-note.entity";
import { SalonImage, SalonImageType } from "../entities/salon-image.entity";
import { Account } from "../entities/account.entity";
import { MembershipPaymentStatus, SalonMembership, SalonMembershipStatus } from "../entities/salon-membership.entity";
import { SalonApplication } from "../entities/salon-application.entity";
import { hashPassword } from "../services/password.service";

const DEMO_SLUG = "demo-salon";
const EXTRA_SALONS = [
  {
    slug: "fizyoflow-kadikoy",
    name: "FizyoFlow Kadıköy",
    city: "İstanbul",
    district: "Kadıköy",
    heroTitle: "Kadıköy'de kişiye özel fizyoterapi ve pilates",
    serviceTitle: "Reformer & Postür",
    price: "650",
  },
  {
    slug: "fizyoflow-besiktas",
    name: "FizyoFlow Beşiktaş",
    city: "İstanbul",
    district: "Beşiktaş",
    heroTitle: "Beşiktaş'ta yoğun tempoya uygun esnek ders planı",
    serviceTitle: "Fonksiyonel Grup Dersi",
    price: "350",
  },
];

type SeedUser = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone: string;
  qrCode: string;
  weeklyClassHours?: number;
};

function plusDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function isoAtLocal(date: Date, hour: number, minute = 0) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function purgeTenantData(tenantId: string) {
  const deleteByTenant = async (entity: any) => {
    await AppDataSource.getRepository(entity)
      .createQueryBuilder()
      .delete()
      .where("tenant_id = :tenantId", { tenantId })
      .execute();
  };

  const orderedEntities: Array<any> = [
    NotificationDelivery,
    NotificationEvent,
    CreditLedger,
    MemberCreditWallet,
    ReferralReward,
    Referral,
    TrainerMemberNote,
    Attendance,
    Booking,
    Availability,
    Measurement,
    RetentionScore,
    UserPackage,
    PackageTrainerAssignment,
    TrainerSkill,
    Invite,
    Lead,
    DeviceToken,
    ClassSession,
    Package,
    NotificationTemplate,
    SalonImage,
    SalonProfile,
    User,
    SalonApplication,
    SalonMembership,
  ];

  for (const entity of orderedEntities) {
    await deleteByTenant(entity);
  }
}

async function upsertTenant(slug: string, name: string) {
  const repo = AppDataSource.getRepository(Tenant);
  let tenant = await repo.findOne({ where: { slug } });

  if (!tenant) {
    tenant = repo.create({
      slug,
      name,
      timezone: "Europe/Istanbul",
      qr_code: `FYF-${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-001`,
      is_active: true,
      review_status: TenantReviewStatus.PUBLISHED,
      subscription_status: TenantSubscriptionStatus.ACTIVE,
      is_public: true,
    });
  } else {
    tenant.slug = slug;
    tenant.name = name;
    tenant.timezone = "Europe/Istanbul";
    tenant.qr_code = tenant.qr_code || `FYF-${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-001`;
    tenant.is_active = true;
    tenant.review_status = TenantReviewStatus.PUBLISHED;
    tenant.subscription_status = TenantSubscriptionStatus.ACTIVE;
    tenant.is_public = true;
  }

  return repo.save(tenant);
}

async function createSalonProfile(
  tenantId: string,
  {
    slug,
    heroTitle,
    heroSubtitle,
    aboutText,
    city,
    district,
    address,
    services,
    phone = "+905555555555",
    whatsapp = "+905555555555",
    instagram = "https://instagram.com/fizyoflow",
    googleMapsUrl = "https://maps.google.com/?q=Fizyoflow",
    googleBusinessUrl = "https://business.google.com/",
    seoTitle,
    seoDescription,
    serviceArea,
    targetAudience,
    brandVoice = "Sakin, güven veren, klinik ama sıcak",
    campaignNote = "İlk değerlendirme ve uygun program bilgisi için WhatsApp üzerinden hızlıca iletişime geçin.",
    reviewUrl = "https://g.page/r/fizyoflow/review",
    galleryUrls = [
      "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=1200&q=82",
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=82",
      "https://images.unsplash.com/photo-1597764699517-22a9dbb68eaa?auto=format&fit=crop&w=1200&q=82",
    ],
  }: {
    slug: string;
    heroTitle: string;
    heroSubtitle: string;
    aboutText: string;
    city: string;
    district: string;
    address: string;
    services: Array<{ title: string; starting_price: string }>;
    phone?: string;
    whatsapp?: string;
    instagram?: string;
    googleMapsUrl?: string;
    googleBusinessUrl?: string;
    seoTitle?: string;
    seoDescription?: string;
    serviceArea?: string[];
    targetAudience?: string;
    brandVoice?: string;
    campaignNote?: string;
    reviewUrl?: string;
    galleryUrls?: string[];
  }
) {
  const repo = AppDataSource.getRepository(SalonProfile);
  const profile = repo.create({
    tenant_id: tenantId,
    slug,
    hero_title: heroTitle,
    hero_subtitle: heroSubtitle,
    about_text: aboutText,
    seo_title: seoTitle || `${heroTitle} | ${district} Fizyoterapi ve Klinik Pilates`,
    seo_description:
      seoDescription ||
      `${district} bölgesinde fizyoterapi, klinik pilates ve hareket odaklı takip için ${heroTitle}. WhatsApp ile bilgi alın.`,
    google_business_url: googleBusinessUrl,
    google_maps_url: googleMapsUrl,
    business_category: "Fizyoterapi Kliniği",
    service_area: serviceArea || [district, city],
    managed_growth_status: ManagedGrowthStatus.LIVE,
    digital_brief: {
      logo_url: "https://dummyimage.com/240x240/6f9274/ffffff&text=F",
      gallery_urls: galleryUrls,
      working_hours_note: "Hafta içi 09:00-20:00, Cumartesi 10:00-16:00",
      review_url: reviewUrl,
      campaign_note: campaignNote,
      target_audience: targetAudience || `${district} ve çevresinde fizyoterapi, postür ve kontrollü hareket desteği arayan danışanlar`,
      brand_voice: brandVoice,
      missing_items: [],
      internal_notes: "Seed demo vitrini; canlı klinik verisiyle değiştirilebilir.",
      approved_at: new Date().toISOString(),
    },
    why_us: [
      { title: "Kişiselleştirilmiş takip", desc: "Değerlendirme, paket ve ders akışı danışanın ihtiyacına göre planlanır." },
      { title: "Şeffaf ders planı", desc: "Takvim, paket ve eğitmen bilgileri sade bir ritimde takip edilir." },
      { title: "Ölçülebilir gelişim", desc: "Seans ve ölçüm verileri düzenli ilerlemeyi görünür kılar." },
    ],
    services,
    location: {
      city,
      district,
      phone,
      address,
      maps_embed_url: googleMapsUrl,
      campaigns: {
        referral_campaigns: [
          {
            id: "ref-default-2",
            required_referrals: 2,
            reward_type: "GROUP_CLASS_CREDIT",
            reward_value: 1,
            reward_label: "1 Grup Dersi Hediyesi",
            is_active: true,
          },
        ],
        loyalty_campaigns: [],
        cancellation_policy: {
          min_hours_before_start: 3,
          refund_policy: "NO_REFUND",
        },
      },
    },
    social_links: {
      instagram,
      whatsapp,
      website: `https://${slug}.fizyoflow.com`,
    },
    theme: "fizyoflow-v2",
    primary_color: "#6f9274",
    business_hours: {
      timezone: "Europe/Istanbul",
      working_days: [1, 2, 3, 4, 5, 6],
      start_time: "09:00",
      end_time: "17:00",
      lunch_break_start: "12:00",
      lunch_break_end: "13:00",
      slot_minutes: 60,
    },
    is_published: true,
  });

  await repo.save(profile);

  if (galleryUrls.length) {
    const imageRepo = AppDataSource.getRepository(SalonImage);
    await imageRepo.save(
      galleryUrls.map((url, index) =>
        imageRepo.create({
          tenant_id: tenantId,
          type: SalonImageType.GALLERY,
          url,
          sort_order: index,
          meta: { source: "seed", alt: `${heroTitle} galeri ${index + 1}` },
        })
      )
    );
  }
}

async function createCatalogSalon(input: {
  slug: string;
  name: string;
  city: string;
  district: string;
  heroTitle: string;
  serviceTitle: string;
  price: string;
}) {
  const tenant = await upsertTenant(input.slug, input.name);
  await createSalonProfile(tenant.id, {
    slug: input.slug,
    heroTitle: input.heroTitle,
    heroSubtitle: "Yeni başlayanlar ve düzenli takibi önemseyen üyeler için sade deneyim",
    aboutText: `${input.name}, ${input.city} ${input.district} bölgesinde fizyoterapi ve hareket odaklı seanslar sunar.`,
    city: input.city,
    district: input.district,
    address: `${input.district}, ${input.city}`,
    services: [
      { title: input.serviceTitle, starting_price: input.price },
      { title: "Değerlendirme Seansı", starting_price: "0" },
    ],
  });

  await AppDataSource.getRepository(Package).save(
    AppDataSource.getRepository(Package).create({
      tenant_id: tenant.id,
      title: `${input.serviceTitle} Başlangıç Paketi`,
      type: PackageType.OTHER,
      total_credits: 4,
      duration_days: 30,
      capacity: 4,
      display_price: input.price,
      is_active: true,
      is_visible: true,
      is_public: true,
      rules: { lesson_category: LessonCategory.GRUP, max_group_size: 4 },
    })
  );
}

async function createAccountAndMembership(tenantId: string, user: User, role: UserRole) {
  const accountRepo = AppDataSource.getRepository(Account);
  let account = await accountRepo.findOne({ where: { email: user.email } });
  if (!account) {
    account = accountRepo.create({
      email: user.email,
      password_hash: user.password_hash,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      global_role_default: role,
      is_active: true,
    });
    await accountRepo.save(account);
  }

  const membershipRepo = AppDataSource.getRepository(SalonMembership);
  const membership = membershipRepo.create({
    account_id: account.id,
    tenant_id: tenantId,
    user_id: user.id,
    role,
    status: SalonMembershipStatus.ACTIVE,
    payment_status: MembershipPaymentStatus.VERIFIED,
    approved_at: new Date(),
    joined_at: new Date(),
    is_active_context: true,
  });
  await membershipRepo.save(membership);
}

async function createUser(tenantId: string, params: SeedUser) {
  const repo = AppDataSource.getRepository(User);
  const passwordHash = await hashPassword(params.password);

  const user = repo.create({
    tenant_id: tenantId,
    email: params.email,
    password_hash: passwordHash,
    first_name: params.firstName,
    last_name: params.lastName,
    role: params.role,
    phone: params.phone,
    qr_code: params.qrCode,
    is_active: true,
    weekly_class_hours: params.weeklyClassHours ?? (params.role === UserRole.MEMBER ? 1 : null),
  });

  return repo.save(user);
}

async function main() {
  ScriptSafetyService.assertNonProductionScript("seed");
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  await AppDataSource.initialize();
  await AppDataSource.synchronize();

  const tenant = await upsertTenant(DEMO_SLUG, "Demo-Salon");
  await purgeTenantData(tenant.id);
  await createSalonProfile(tenant.id, {
    slug: DEMO_SLUG,
    heroTitle: "FizyoFlow ile Bilimsel Fizyoterapi Takibi",
    heroSubtitle: "Uzman ekip, düzenli ölçüm ve sürdürülebilir gelişim planı",
    aboutText: "FizyoFlow, klinik operasyonlarını tek panelden yönetmek için tasarlanmış kurumsal fizyoterapi platformudur.",
    city: "İstanbul",
    district: "Kadıköy",
    address: "Kadıköy, İstanbul",
    services: [
      { title: "Grup Dersi", starting_price: "200" },
      { title: "PT", starting_price: "500" },
      { title: "Pilates / Reformer", starting_price: "700" },
    ],
  });

  const admin = await createUser(tenant.id, {
    email: "oguzhanuyar531@gmail.com",
    password: "admin123",
      firstName: "Oguzhan",
    lastName: "Uyar",
    role: UserRole.ADMIN,
    phone: "5550000001",
    qrCode: "ADM-OGUZ-001",
  });

  const trainer = await createUser(tenant.id, {
    email: "elisauyar@gmail.com",
    password: "trainer123",
    firstName: "Elisa",
    lastName: "Uyar",
    role: UserRole.TRAINER,
    phone: "5550000002",
    qrCode: "TRN-ELISA001",
  });

  const member = await createUser(tenant.id, {
    email: "member@gmail.com",
    password: "member123",
    firstName: "Demo",
    lastName: "Member",
    role: UserRole.MEMBER,
    phone: "5550000003",
    qrCode: "MEM-DEMO001",
    weeklyClassHours: 1,
  });

  const extraMembers = await Promise.all([
    createUser(tenant.id, {
      email: "test1.user@demo.local",
      password: "member123",
      firstName: "Test",
      lastName: "Bir",
      role: UserRole.MEMBER,
      phone: "5550001001",
      qrCode: "MEM-TST1001",
      weeklyClassHours: 1,
    }),
    createUser(tenant.id, {
      email: "test2.user@demo.local",
      password: "member123",
      firstName: "Test",
      lastName: "Iki",
      role: UserRole.MEMBER,
      phone: "5550001002",
      qrCode: "MEM-TST1002",
      weeklyClassHours: 2,
    }),
    createUser(tenant.id, {
      email: "test3.user@demo.local",
      password: "member123",
      firstName: "Test",
      lastName: "Uc",
      role: UserRole.MEMBER,
      phone: "5550001003",
      qrCode: "MEM-TST1003",
      weeklyClassHours: 1,
    }),
    createUser(tenant.id, {
      email: "test4.user@demo.local",
      password: "member123",
      firstName: "Test",
      lastName: "Dort",
      role: UserRole.MEMBER,
      phone: "5550001004",
      qrCode: "MEM-TST1004",
      weeklyClassHours: 1,
    }),
  ]);

  await Promise.all([
    createAccountAndMembership(tenant.id, admin, UserRole.ADMIN),
    createAccountAndMembership(tenant.id, trainer, UserRole.TRAINER),
    createAccountAndMembership(tenant.id, member, UserRole.MEMBER),
    ...extraMembers.map((row) => createAccountAndMembership(tenant.id, row, UserRole.MEMBER)),
  ]);

  tenant.owner_account_id = (await AppDataSource.getRepository(Account).findOne({ where: { email: admin.email } }))?.id || null;
  tenant.review_status = TenantReviewStatus.PUBLISHED;
  tenant.subscription_status = TenantSubscriptionStatus.ACTIVE;
  tenant.is_public = true;
  await AppDataSource.getRepository(Tenant).save(tenant);

  const packageRepo = AppDataSource.getRepository(Package);
  const packages = await packageRepo.save([
    packageRepo.create({
      tenant_id: tenant.id,
      title: "Grup Dersi (8 Kişi)",
      type: PackageType.GROUP,
      total_credits: 8,
      duration_days: 30,
      capacity: 8,
      display_price: "200.00",
      is_active: true,
      is_visible: true,
      is_public: true,
      rules: { lesson_category: LessonCategory.GRUP, max_group_size: 8 },
    }),
    packageRepo.create({
      tenant_id: tenant.id,
      title: "Grup Dersi (4 Kişi)",
      type: PackageType.GROUP,
      total_credits: 8,
      duration_days: 30,
      capacity: 4,
      display_price: "200.00",
      is_active: true,
      is_visible: true,
      is_public: true,
      rules: { lesson_category: LessonCategory.GRUP, max_group_size: 4 },
    }),
    packageRepo.create({
      tenant_id: tenant.id,
      title: "PT Bireysel Ders",
      type: PackageType.PT,
      total_credits: 8,
      duration_days: 30,
      capacity: 1,
      display_price: "500.00",
      is_active: true,
      is_visible: true,
      is_public: true,
      rules: { lesson_category: LessonCategory.PT, max_group_size: 1 },
    }),
    packageRepo.create({
      tenant_id: tenant.id,
      title: "Skolyoz Seansı",
      type: PackageType.SCOLIOSIS,
      total_credits: 8,
      duration_days: 30,
      capacity: 1,
      display_price: "500.00",
      is_active: true,
      is_visible: true,
      is_public: true,
      rules: { lesson_category: LessonCategory.SKOLYOZ, max_group_size: 1 },
    }),
    packageRepo.create({
      tenant_id: tenant.id,
      title: "Pilates Seansı",
      type: PackageType.OTHER,
      total_credits: 8,
      duration_days: 30,
      capacity: 2,
      display_price: "700.00",
      is_active: true,
      is_visible: true,
      is_public: true,
      rules: { lesson_category: LessonCategory.PILATES, max_group_size: 2 },
    }),
    packageRepo.create({
      tenant_id: tenant.id,
      title: "Reformer Seansı",
      type: PackageType.REFORMER,
      total_credits: 8,
      duration_days: 30,
      capacity: 2,
      display_price: "700.00",
      is_active: true,
      is_visible: true,
      is_public: true,
      rules: { lesson_category: LessonCategory.REFORMER, max_group_size: 2 },
    }),
  ]);

  const [group8, group4, ptPackage] = packages;

  await AppDataSource.getRepository(TrainerSkill).save([
    AppDataSource.getRepository(TrainerSkill).create({
      tenant_id: tenant.id,
      trainer_id: trainer.id,
      lesson_category: LessonCategory.GRUP,
      is_active: true,
    }),
    AppDataSource.getRepository(TrainerSkill).create({
      tenant_id: tenant.id,
      trainer_id: trainer.id,
      lesson_category: LessonCategory.PT,
      is_active: true,
    }),
  ]);

  await AppDataSource.getRepository(PackageTrainerAssignment).save([
    AppDataSource.getRepository(PackageTrainerAssignment).create({
      tenant_id: tenant.id,
      trainer_id: trainer.id,
      package_id: group8.id,
      is_active: true,
    }),
    AppDataSource.getRepository(PackageTrainerAssignment).create({
      tenant_id: tenant.id,
      trainer_id: trainer.id,
      package_id: group4.id,
      is_active: true,
    }),
    AppDataSource.getRepository(PackageTrainerAssignment).create({
      tenant_id: tenant.id,
      trainer_id: trainer.id,
      package_id: ptPackage.id,
      is_active: true,
    }),
  ]);

  const now = new Date();
  const userPackageRepo = AppDataSource.getRepository(UserPackage);
  const memberPackages = await userPackageRepo.save([
    userPackageRepo.create({
      tenant_id: tenant.id,
      user_id: member.id,
      package_id: group8.id,
      remaining_credits: 12,
      starts_at: plusDays(now, -10),
      expires_at: plusDays(now, 20),
      is_active: true,
    }),
    userPackageRepo.create({
      tenant_id: tenant.id,
      user_id: member.id,
      package_id: ptPackage.id,
      remaining_credits: 6,
      starts_at: plusDays(now, -10),
      expires_at: plusDays(now, 20),
      is_active: true,
    }),
  ]);

  for (const [index, extraMember] of extraMembers.entries()) {
    await userPackageRepo.save(
      userPackageRepo.create({
        tenant_id: tenant.id,
        user_id: extraMember.id,
        package_id: index % 2 === 0 ? group8.id : ptPackage.id,
        remaining_credits: 4,
        starts_at: plusDays(now, -3),
        expires_at: plusDays(now, 27),
        is_active: true,
      })
    );
  }

  const sessionRepo = AppDataSource.getRepository(ClassSession);
  const sessions = await sessionRepo.save([
    sessionRepo.create({
      tenant_id: tenant.id,
      title: "Grup Core Dersi",
      type: SessionType.GROUP,
      status: SessionStatus.SCHEDULED,
      trainer_id: trainer.id,
      related_package_id: group8.id,
      lesson_category: LessonCategory.GRUP,
      starts_at: plusDays(now, 1),
      ends_at: plusDays(now, 1),
      capacity: 8,
    }),
    sessionRepo.create({
      tenant_id: tenant.id,
      title: "PT Postür Dersi",
      type: SessionType.PT,
      status: SessionStatus.COMPLETED,
      trainer_id: trainer.id,
      related_package_id: ptPackage.id,
      lesson_category: LessonCategory.PT,
      starts_at: plusDays(now, -2),
      ends_at: plusDays(now, -2),
      capacity: 1,
    }),
  ]);

  sessions[0].starts_at = isoAtLocal(sessions[0].starts_at, 10, 0);
  sessions[0].ends_at = isoAtLocal(sessions[0].ends_at, 11, 0);
  sessions[1].starts_at = isoAtLocal(sessions[1].starts_at, 18, 0);
  sessions[1].ends_at = isoAtLocal(sessions[1].ends_at, 19, 0);
  await sessionRepo.save(sessions);

  const bookingRepo = AppDataSource.getRepository(Booking);
  await bookingRepo.save([
    bookingRepo.create({
      tenant_id: tenant.id,
      member_id: member.id,
      trainer_id: trainer.id,
      session_id: sessions[0].id,
      starts_at: sessions[0].starts_at,
      ends_at: sessions[0].ends_at,
      status: BookingStatus.PENDING,
      payment_status: BookingPaymentStatus.REQUESTED,
      payment_requested_at: now,
      meta: { package_id: group8.id, package_display_price: group8.display_price },
    }),
    bookingRepo.create({
      tenant_id: tenant.id,
      member_id: member.id,
      trainer_id: trainer.id,
      session_id: sessions[1].id,
      starts_at: sessions[1].starts_at,
      ends_at: sessions[1].ends_at,
      status: BookingStatus.APPROVED,
      payment_status: BookingPaymentStatus.APPROVED,
      payment_requested_at: plusDays(now, -3),
      payment_approved_at: plusDays(now, -2),
      payment_approved_by_admin_id: admin.id,
      meta: { package_id: ptPackage.id, package_display_price: ptPackage.display_price },
    }),
  ]);

  const attendanceRepo = AppDataSource.getRepository(Attendance);
  await attendanceRepo.save([
    attendanceRepo.create({
      tenant_id: tenant.id,
      member_id: member.id,
      trainer_id: trainer.id,
      session_id: sessions[1].id,
      user_package_id: memberPackages[1].id,
      credits_deducted: 1,
      result: AttendanceResult.CREDIT_DEDUCTED,
      meta: { lesson_category: LessonCategory.PT },
    }),
    attendanceRepo.create({
      tenant_id: tenant.id,
      member_id: member.id,
      trainer_id: trainer.id,
      session_id: sessions[1].id,
      user_package_id: memberPackages[0].id,
      credits_deducted: 1,
      result: AttendanceResult.CREDIT_DEDUCTED,
      meta: { lesson_category: LessonCategory.GRUP },
    }),
  ]);

  const measurementRepo = AppDataSource.getRepository(Measurement);
  await measurementRepo.save([
    measurementRepo.create({
      tenant_id: tenant.id,
      member_id: member.id,
      trainer_id: trainer.id,
      measured_at: plusDays(now, -70),
      height_cm: "180.00",
      weight_kg: "82.00",
      fat_percent: "19.80",
      muscle_kg: "32.00",
      extras: {},
    }),
    measurementRepo.create({
      tenant_id: tenant.id,
      member_id: member.id,
      trainer_id: trainer.id,
      measured_at: plusDays(now, -40),
      height_cm: "180.00",
      weight_kg: "80.20",
      fat_percent: "18.60",
      muscle_kg: "32.80",
      extras: {},
    }),
    measurementRepo.create({
      tenant_id: tenant.id,
      member_id: member.id,
      trainer_id: trainer.id,
      measured_at: plusDays(now, -10),
      height_cm: "180.00",
      weight_kg: "78.50",
      fat_percent: "17.20",
      muscle_kg: "33.40",
      extras: {},
    }),
  ]);

  const availabilityRepo = AppDataSource.getRepository(Availability);
  const nextMonday = plusDays(now, (8 - (now.getDay() || 7)) % 7 || 7);

  await availabilityRepo.save([
    availabilityRepo.create({
      tenant_id: tenant.id,
      member_id: extraMembers[0].id,
      package_id: group8.id,
      starts_at: isoAtLocal(nextMonday, 18, 0),
      ends_at: isoAtLocal(nextMonday, 19, 0),
      note: "Pazartesi akşam uygunum",
    }),
    availabilityRepo.create({
      tenant_id: tenant.id,
      member_id: extraMembers[1].id,
      package_id: ptPackage.id,
      starts_at: isoAtLocal(plusDays(nextMonday, 1), 12, 0),
      ends_at: isoAtLocal(plusDays(nextMonday, 1), 13, 0),
      note: "Salı öğle arası uygunum",
    }),
    availabilityRepo.create({
      tenant_id: tenant.id,
      member_id: extraMembers[2].id,
      package_id: group4.id,
      starts_at: isoAtLocal(plusDays(nextMonday, 2), 9, 0),
      ends_at: isoAtLocal(plusDays(nextMonday, 2), 10, 0),
      note: "Çarşamba sabah gelebilirim",
    }),
    availabilityRepo.create({
      tenant_id: tenant.id,
      member_id: extraMembers[3].id,
      package_id: group8.id,
      starts_at: isoAtLocal(plusDays(nextMonday, 5), 12, 0),
      ends_at: isoAtLocal(plusDays(nextMonday, 5), 13, 0),
      note: "Cumartesi öğlen uygunum",
    }),
  ]);

  await AppDataSource.getRepository(Lead).save([
    AppDataSource.getRepository(Lead).create({
      tenant_id: tenant.id,
      full_name: "Ayşe Demir",
      phone: "5559871111",
      interest: "Skolyoz",
      availability_note: "Hafta içi akşam",
      status: LeadStatus.NEW,
    }),
    AppDataSource.getRepository(Lead).create({
      tenant_id: tenant.id,
      full_name: "Mehmet Kaya",
      phone: "5559872222",
      interest: "Reformer",
      availability_note: "Sabah saatleri",
      status: LeadStatus.CONTACTED,
    }),
  ]);

  const notificationTemplateRepo = AppDataSource.getRepository(NotificationTemplate);
  await notificationTemplateRepo.save([
    notificationTemplateRepo.create({
      tenant_id: tenant.id,
      type: NotificationType.PACKAGE_ENDING,
      title: "Paket süreniz yaklaşıyor",
      body: "Paket haklarınızı kesintisiz kullanmak için yenileme talebi oluşturabilirsiniz.",
      settings: { mode: "SCHEDULED", cadence: "WEEKLY", next_run_at: null },
      is_active: true,
    }),
    notificationTemplateRepo.create({
      tenant_id: tenant.id,
      type: NotificationType.MEASUREMENT_DUE,
      title: "Yeni ölçüm zamanı",
      body: "Gelişim takibinizi güncel tutmak için yeni ölçüm planlayın.",
      settings: { mode: "SCHEDULED", cadence: "EVERY_3_DAYS", next_run_at: null },
      is_active: true,
    }),
    notificationTemplateRepo.create({
      tenant_id: tenant.id,
      type: NotificationType.SESSION_REMINDER,
      title: "Seans hatırlatması",
      body: "Planlı seansınız yaklaşırken check-in adımını tamamlamayı unutmayın.",
      settings: { mode: "INSTANT", cadence: "DAILY", next_run_at: null },
      is_active: true,
    }),
  ]);

  const referral = await AppDataSource.getRepository(Referral).save(
    AppDataSource.getRepository(Referral).create({
      tenant_id: tenant.id,
      inviter_member_id: member.id,
      invitee_name: "Demo Arkadaş",
      invitee_phone_or_email: "friend@demo.local",
      code: "REF-DEMO-001",
      status: ReferralStatus.REWARDED,
      converted_at: plusDays(now, -7),
    })
  );

  await AppDataSource.getRepository(ReferralReward).save(
    AppDataSource.getRepository(ReferralReward).create({
      tenant_id: tenant.id,
      referral_id: referral.id,
      member_id: member.id,
      credits_granted: 1,
      rule_name: "1 davet = 1 grup dersi",
      granted_at: plusDays(now, -7),
    })
  );

  const wallet = await AppDataSource.getRepository(MemberCreditWallet).save(
    AppDataSource.getRepository(MemberCreditWallet).create({
      tenant_id: tenant.id,
      member_id: member.id,
      referral_group_credits: 1,
    })
  );

  await AppDataSource.getRepository(CreditLedger).save(
    AppDataSource.getRepository(CreditLedger).create({
      tenant_id: tenant.id,
      member_id: member.id,
      delta: 1,
      balance_after: wallet.referral_group_credits,
      source: CreditLedgerSource.REFERRAL_REWARD,
      reference_type: "REFERRAL",
      reference_id: referral.id,
      meta: { note: "Seed referral reward" },
    })
  );

  for (const salon of EXTRA_SALONS) {
    await createCatalogSalon(salon);
  }

  console.log("Seed completed");
  console.log(`tenantSlug: ${DEMO_SLUG}`);
  console.log("admin: oguzhanuyar531@gmail.com / admin123");
  console.log("trainer: elisauyar@gmail.com / trainer123");
  console.log("member: member@gmail.com / member123");
  console.log("packages:");
  console.log("- Grup (4/8 kişi): 200 TL");
  console.log("- PT: 500 TL");
  console.log("- Skolyoz: 500 TL");
  console.log("- Pilates/Reformer: 700 TL");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });
