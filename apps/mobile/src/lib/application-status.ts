// Bu helper modulu mobil tarafta application status ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
type ApplicationLike = {
  status?: string | null;
  payment_status?: string | null;
};

type PendingPaymentRequestLike = {
  status?: string | null;
};

type ActiveMembershipLike = {
  tenant_name?: string | null;
  tenant_slug?: string | null;
} | null;

export function isApplicationPaymentPending(
  latestApplication: ApplicationLike | null,
  pendingPaymentRequest?: PendingPaymentRequestLike | null
) {
  return (
    pendingPaymentRequest?.status === "PENDING" ||
    (latestApplication?.status === "APPROVED" && latestApplication?.payment_status !== "VERIFIED")
  );
}

export function deriveApplicationStatusState(params: {
  activeMembership: ActiveMembershipLike;
  latestApplication: ApplicationLike | null;
  pendingPaymentRequest?: PendingPaymentRequestLike | null;
}) {
  const { activeMembership, latestApplication, pendingPaymentRequest } = params;

  if (activeMembership) {
    return {
      mode: "active-membership" as const,
      tone: "success" as const,
      title: "Salonun hazır",
      copy: `${activeMembership.tenant_name || activeMembership.tenant_slug} için üyeliğin aktif görünüyor.`,
    };
  }

  if (!latestApplication) {
    return {
      mode: "empty" as const,
      tone: "primary" as const,
      title: "Başvuru görünmüyor",
      copy: "Henüz bir salon başvurun bulunmuyor.",
    };
  }

  const paymentPending = isApplicationPaymentPending(latestApplication, pendingPaymentRequest);
  return {
    mode: paymentPending ? ("payment-pending" as const) : ("in-review" as const),
    tone: paymentPending ? ("warning" as const) : ("primary" as const),
    title: paymentPending ? "Ödeme Bekleniyor" : "Başvurun Değerlendiriliyor",
    copy: paymentPending
      ? "Salon seni ön onaya aldı. Şimdi ödeme onayının tamamlanması bekleniyor; ödeme onayından sonra üyeliğin aktifleşecek."
      : "Başvurun alındı. Salon yöneticisi onay verdiğinde kayıt ödeme akışına alınacak.",
  };
}
