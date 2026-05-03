import { requireServerRole } from "@/lib/server-auth";

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  await requireServerRole("TRAINER");
  return children;
}
