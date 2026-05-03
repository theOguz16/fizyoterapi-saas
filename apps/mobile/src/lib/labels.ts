// apps/mobile/src/lib/labels.ts

export function statusLabel(status?: string | null) {
  const value = String(status || "").toUpperCase();

  const labels: Record<string, string> = {
    PENDING: "Bekliyor",
    APPROVED: "Onaylandı",
    REJECTED: "Reddedildi",
    CANCELED: "İptal edildi",
    CANCELLED: "İptal edildi",
    RESCHEDULED: "Yeniden planlandı",
    SCHEDULED: "Planlandı",
    COMPLETED: "Tamamlandı",
    ACTIVE: "Aktif",
    INACTIVE: "Pasif",
    EXPIRED: "Süresi doldu",
    UPCOMING: "Yaklaşan",
    VERIFIED: "Doğrulandı",
    REQUESTED: "Talep edildi",
    OPEN: "Açık",
    JOINED: "Katıldı",
    WAITING: "Bekliyor",
    TRIAL: "Deneme",
    PUBLISHED: "Yayında",
    WAIT_REVIEW: "İnceleme bekliyor",
    START_TRIAL: "Deneme başlat",
    PURCHASE_IN_APP: "Uygulama içi satın alma",
    MANAGE_PLAN: "Planı yönet",
  };

  return labels[value] || status || "-";
}

export function approvalTypeLabel(type?: string | null) {
  const value = String(type || "").toUpperCase();

  const labels: Record<string, string> = {
    APPLICATION: "Başvuru",
    PAYMENT: "Ödeme",
    CHANGE_REQUEST: "Değişiklik talebi",
    PACKAGE_RENEWAL: "Paket yenileme",
    PACKAGE_CANCEL: "Paket iptali",
    TRAINER_CHANGE: "Eğitmen değişikliği",
  };

  return labels[value] || type || "-";
}

export function paymentStatusLabel(status?: string | null) {
  const value = String(status || "").toUpperCase();

  const labels: Record<string, string> = {
    PENDING: "Bekliyor",
    REQUESTED: "Talep edildi",
    APPROVED: "Onaylandı",
    REJECTED: "Reddedildi",
    VERIFIED: "Doğrulandı",
  };

  return labels[value] || status || "-";
}

export function packageTypeLabel(type?: string | null) {
  const value = String(type || "").toUpperCase();

  const labels: Record<string, string> = {
    GROUP: "Grup dersi",
    PT: "Özel ders",
    REFORMER: "Reformer",
    MANUAL: "Manuel terapi",
    SCOLIOSIS: "Skolyoz",
    OTHER: "Diğer",
  };

  return labels[value] || type || "-";
}

export function lessonModeLabel(mode?: string | null) {
  const value = String(mode || "").toUpperCase();

  const labels: Record<string, string> = {
    SINGLE: "Tekli ders",
    MULTI: "Çoklu ders",
    GROUP: "Grup dersi",
    DUO: "İkili ders"
  };

  return labels[value] || mode || "-";
}

export function bookingStatusLabel(status?: string | null) {
  const value = String(status || "").toUpperCase();

  const labels: Record<string, string> = {
    PENDING: "Bekliyor",
    APPROVED: "Onaylandı",
    SCHEDULED: "Planlandı",
    CANCELED: "İptal edildi",
    RESCHEDULED: "Yeniden planlandı",
    COMPLETED: "Tamamlandı",
  };

  return labels[value] || status || "-";
}