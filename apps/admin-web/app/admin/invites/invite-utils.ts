type InviteStatus = "PENDING" | "ACCEPTED" | "CANCELED" | "EXPIRED";

export function inviteStatusLabel(status: InviteStatus) {
  if (status === "PENDING") return "Bekliyor";
  if (status === "ACCEPTED") return "Kabul Edildi";
  if (status === "CANCELED") return "İptal";
  return "Süresi Doldu";
}

export function resolveInviteFormError(emailOrPhone: string, expiresInHours: number) {
  if (!emailOrPhone.trim()) return "E-posta veya telefon zorunludur.";
  if (expiresInHours <= 0) return "Geçerlilik süresi 1 saatten büyük olmalıdır.";
  return "";
}
