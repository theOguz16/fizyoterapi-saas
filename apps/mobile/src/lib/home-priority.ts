import type { AppIconName } from "@/theme/components/app-icon";
import type { QuickSetupStep } from "@/lib/admin-dashboard";
import {
  canTrainerBookingCheckIn,
  canTrainerBookingManageSchedule,
  sortTrainerTodayBookings,
  type TrainerTodayBooking,
} from "@/lib/trainer-today";

export type HomePriorityTone = "primary" | "success" | "warning" | "danger";

export type HomePriorityItem = {
  key: string;
  title: string;
  description: string;
  value?: string | number;
  tone: HomePriorityTone;
  icon: AppIconName;
  route: string | null;
  params?: Record<string, string>;
  priority: number;
  testID: string;
};

type AdminHomePriorityInput = {
  setup?: {
    isComplete: boolean;
    completed: number;
    total: number;
    nextStep: QuickSetupStep | null;
  } | null;
  pendingApprovals?: number | null;
  todaysBookings?: number | null;
  atRiskMembers?: number | null;
};

type TrainerHomePriorityInput = {
  bookings?: TrainerTodayBooking[] | null;
  pendingRequestCount?: number | null;
  now?: number;
};

type MemberBooking = {
  id?: string | number | null;
  starts_at?: string | null;
  session_title?: string | null;
  lesson_category_label?: string | null;
};

type MemberHomePriorityInput = {
  pendingScheduleRequestCount?: number | null;
  hasPendingApplication?: boolean;
  nextBooking?: MemberBooking | null;
  remainingCredits?: number | null;
  groupClassCount?: number | null;
};

function positiveNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function selectVisible(items: HomePriorityItem[]) {
  return items.sort((left, right) => left.priority - right.priority).slice(0, 3);
}

function formatTime(value?: string | null) {
  if (!value) return "Saat bilgisi bekleniyor";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saat bilgisi bekleniyor";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildAdminHomePriorities(input: AdminHomePriorityInput): HomePriorityItem[] {
  const items: HomePriorityItem[] = [];
  const setup = input.setup;
  const pendingApprovals = positiveNumber(input.pendingApprovals);
  const todaysBookings = positiveNumber(input.todaysBookings);
  const atRiskMembers = positiveNumber(input.atRiskMembers);

  if (setup && !setup.isComplete && setup.nextStep) {
    items.push({
      key: "setup",
      title: "Kurulumu tamamla",
      description: `${setup.nextStep.title} adımı salonunu kullanıma hazır hale getirmek için sırada.`,
      value: `${setup.completed}/${setup.total}`,
      tone: "warning",
      icon: setup.nextStep.icon,
      route: setup.nextStep.route,
      priority: 10,
      testID: "admin-home-priority-setup",
    });
  }

  if (pendingApprovals > 0) {
    items.push({
      key: "approvals",
      title: "Onay bekleyen işlemler var",
      description: "Üye, paket ve ders taleplerini inceleyerek operasyonu ilerlet.",
      value: pendingApprovals,
      tone: "warning",
      icon: "approvals",
      route: "/(admin)/approvals",
      priority: 20,
      testID: "admin-home-priority-approvals",
    });
  }

  if (todaysBookings > 0) {
    items.push({
      key: "today",
      title: "Bugünün ders planı",
      description: "Takvimdeki dersleri, kapasiteyi ve olası çakışmaları kontrol et.",
      value: todaysBookings,
      tone: "primary",
      icon: "calendar",
      route: "/(admin)/calendar",
      priority: 30,
      testID: "admin-home-priority-today",
    });
  }

  if (atRiskMembers > 0) {
    items.push({
      key: "risk",
      title: "Takip edilmesi gereken üyeler",
      description: "Katılımı düşen üyelerin risk sinyallerini incele.",
      value: atRiskMembers,
      tone: "danger",
      icon: "risk",
      route: "/(admin)/risk-members",
      priority: 40,
      testID: "admin-home-priority-risk",
    });
  }

  if (items.length === 0) {
    items.push({
      key: "success",
      title: "Operasyon kontrol altında",
      description: "Kurulum tamamlandı; bugün bekleyen kritik bir işlem görünmüyor.",
      tone: "success",
      icon: "dashboard",
      route: null,
      priority: 100,
      testID: "admin-home-priority-success",
    });
  }

  return selectVisible(items);
}

export function buildTrainerHomePriorities(input: TrainerHomePriorityInput): HomePriorityItem[] {
  const bookings = sortTrainerTodayBookings(input.bookings);
  const pendingRequestCount = positiveNumber(input.pendingRequestCount);
  const now = input.now ?? Date.now();
  const activeBookings = bookings.filter(canTrainerBookingManageSchedule);
  const checkinBookings = activeBookings.filter(canTrainerBookingCheckIn);
  const imminentBooking = checkinBookings.find((booking) => {
    const startsAt = new Date(String(booking.starts_at || "")).getTime();
    if (!Number.isFinite(startsAt)) return false;
    const minutesUntilStart = (startsAt - now) / 60_000;
    return minutesUntilStart >= -60 && minutesUntilStart <= 120;
  });
  const items: HomePriorityItem[] = [];

  if (imminentBooking) {
    items.push({
      key: "imminent",
      title: imminentBooking.member_full_name
        ? `${imminentBooking.member_full_name} seansı yaklaşıyor`
        : "Yaklaşan seans için hazırlan",
      description: `${formatTime(imminentBooking.starts_at)} • Check-in işlemi hazır.`,
      tone: "primary",
      icon: "checkin",
      route: "/(trainer)/checkin",
      params: imminentBooking.session_id ? { sessionId: String(imminentBooking.session_id) } : undefined,
      priority: 10,
      testID: "trainer-home-priority-imminent",
    });
  }

  if (pendingRequestCount > 0) {
    items.push({
      key: "requests",
      title: "Yanıt bekleyen değişiklikler",
      description: "Saat değişikliği ve iptal taleplerinin durumunu kontrol et.",
      value: pendingRequestCount,
      tone: "warning",
      icon: "request",
      route: "/(trainer)/request-center",
      priority: 20,
      testID: "trainer-home-priority-requests",
    });
  }

  const checkinBooking = checkinBookings.find((booking) => booking !== imminentBooking);
  if (checkinBooking) {
    items.push({
      key: "checkin",
      title: "Check-in yapılabilir seans",
      description: `${checkinBooking.member_full_name || "Danışan"} • ${formatTime(checkinBooking.starts_at)}`,
      tone: "primary",
      icon: "checkin",
      route: "/(trainer)/checkin",
      params: checkinBooking.session_id ? { sessionId: String(checkinBooking.session_id) } : undefined,
      priority: 30,
      testID: "trainer-home-priority-checkin",
    });
  }

  const nextBooking = activeBookings.find(
    (booking) => booking !== imminentBooking && booking !== checkinBooking
  );
  if (nextBooking) {
    items.push({
      key: "next",
      title: "Sıradaki seans",
      description: `${nextBooking.member_full_name || "Danışan"} • ${formatTime(nextBooking.starts_at)}`,
      tone: "primary",
      icon: "calendar",
      route: "/(trainer)/calendar",
      params: nextBooking.id ? { bookingId: String(nextBooking.id) } : undefined,
      priority: 40,
      testID: "trainer-home-priority-next",
    });
  }

  if (items.length === 0) {
    items.push({
      key: "empty",
      title: "Bugün planlı seans yok",
      description: "Haftanın programını incelemek veya yeni ders planlamak için takvimi aç.",
      tone: "success",
      icon: "calendar",
      route: "/(trainer)/calendar",
      priority: 100,
      testID: "trainer-home-priority-empty",
    });
  }

  return selectVisible(items);
}

export function buildMemberHomePriorities(input: MemberHomePriorityInput): HomePriorityItem[] {
  const pendingScheduleRequestCount = positiveNumber(input.pendingScheduleRequestCount);
  const remainingCredits = Math.max(0, Number(input.remainingCredits || 0));
  const groupClassCount = positiveNumber(input.groupClassCount);
  const nextBooking = input.nextBooking;
  const items: HomePriorityItem[] = [];

  if (pendingScheduleRequestCount > 0) {
    items.push({
      key: "schedule-request",
      title: "Saat değişikliği yanıt bekliyor",
      description: "Eğitmeninin önerdiği yeni saati aşağıdaki karttan onayla veya reddet.",
      value: pendingScheduleRequestCount,
      tone: "warning",
      icon: "approvals",
      route: null,
      priority: 10,
      testID: "member-home-priority-schedule-request",
    });
  }

  if (input.hasPendingApplication) {
    items.push({
      key: "application",
      title: "Üyelik işlemin devam ediyor",
      description: "Başvuru veya ödeme durumunu Paketim ekranından takip et.",
      tone: "warning",
      icon: "package",
      route: "/(member)/package",
      priority: 20,
      testID: "member-home-priority-application",
    });
  }

  if (nextBooking?.id) {
    items.push({
      key: "next-booking",
      title: nextBooking.session_title || nextBooking.lesson_category_label || "Sonraki dersin",
      description: formatTime(nextBooking.starts_at),
      tone: "primary",
      icon: "calendar",
      route: "/(member)/booking/[id]",
      params: { id: String(nextBooking.id) },
      priority: 30,
      testID: "member-home-priority-next-booking",
    });
  }

  if (remainingCredits <= 2) {
    items.push({
      key: "low-credits",
      title: remainingCredits === 0 ? "Kullanılabilir ders hakkın yok" : "Ders hakların azalıyor",
      description: "Ders planının kesintiye uğramaması için paket seçeneklerini incele.",
      value: remainingCredits,
      tone: remainingCredits === 0 ? "danger" : "warning",
      icon: "ticket",
      route: "/(member)/package",
      priority: 40,
      testID: "member-home-priority-low-credits",
    });
  }

  if (groupClassCount > 0) {
    items.push({
      key: "group-class",
      title: "Katılabileceğin grup dersleri var",
      description: "Programına uyan grup derslerini ve kontenjanları incele.",
      value: groupClassCount,
      tone: "primary",
      icon: "dumbbell",
      route: "/(member)/group-classes",
      priority: 50,
      testID: "member-home-priority-group-class",
    });
  }

  if (!nextBooking && pendingScheduleRequestCount === 0 && !input.hasPendingApplication) {
    items.push({
      key: "no-booking",
      title: "Planlanmış dersin yok",
      description: "Uygun saatleri görmek ve yeni ders planlamak için takvimi aç.",
      tone: "success",
      icon: "calendar",
      route: "/(member)/calendar",
      priority: 60,
      testID: "member-home-priority-no-booking",
    });
  }

  return selectVisible(items);
}
