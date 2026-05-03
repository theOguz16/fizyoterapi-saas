export function bookingStatusLabel(status?: string | null) {
  switch (status) {
    case "PENDING":
      return "Onay Bekliyor";
    case "APPROVED":
      return "Onaylandı";
    case "CANCELED":
      return "İptal Edildi";
    case "RESCHEDULED":
      return "Yeniden Planlandı";
    default:
      return status || "Belirtilmedi";
  }
}

export function paymentStatusLabel(status?: string | null) {
  switch (status) {
    case "UNPAID":
      return "Ödeme Bekleniyor";
    case "PAID":
      return "Ödeme Bildirildi";
    case "VERIFIED":
      return "Ödeme Onaylandı";
    case "REQUESTED":
      return "Ödeme Kontrolünde";
    case "APPROVED":
      return "Ödeme Onaylandı";
    case "REJECTED":
      return "Ödeme Reddedildi";
    default:
      return status || "Belirtilmedi";
  }
}

export function attendanceResultLabel(result?: string | null) {
  switch (result) {
    case "CREDIT_DEDUCTED":
      return "Derse katıldı";
    case "NO_CREDIT":
      return "Katılım Reddedildi (Hak Yetersiz)";
    case "PACKAGE_EXPIRED":
      return "Katılım Reddedildi (Paket Süresi Doldu)";
    case "USER_INACTIVE":
      return "Katılım Reddedildi (Hesap Donduruldu)";
    default:
      return result || "Belirtilmedi";
  }
}

export function riskLabel(level?: string | null) {
  switch (level) {
    case "HIGH":
      return "Çok Riskli";
    case "MEDIUM":
      return "Riskli";
    case "LOW":
      return "Stabil";
    default:
      return "Belirtilmedi";
  }
}
