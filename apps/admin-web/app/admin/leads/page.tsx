import { redirect } from "next/navigation";

export default function LegacyAdminLeadsRedirectPage() {
  redirect("/admin/applications");
}
