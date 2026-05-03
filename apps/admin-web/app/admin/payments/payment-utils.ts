type MembershipApplicationLike = {
  status: string;
  payment_status: string;
};

type PaymentStatus = "REQUESTED" | "APPROVED" | "REJECTED";

export function membershipQueueFilter(row: MembershipApplicationLike, filter: PaymentStatus) {
  if (filter === "REQUESTED") return row.status === "APPROVED" && row.payment_status !== "VERIFIED";
  if (filter === "APPROVED") return row.status === "APPROVED" && row.payment_status === "VERIFIED";
  return row.status === "REJECTED";
}

export function paymentFilterLabel(filter: PaymentStatus) {
  if (filter === "REQUESTED") return "Bekleyen";
  if (filter === "APPROVED") return "Onaylanan";
  return "Reddedilen";
}
