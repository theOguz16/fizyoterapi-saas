import { requireServerRole } from "@/lib/server-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireServerRole("ADMIN");
  return children;
}
