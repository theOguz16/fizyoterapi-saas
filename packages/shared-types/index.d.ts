export type UserRole = "ADMIN" | "TRAINER" | "MEMBER";

export interface AuthSessionUser {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
  fullName: string;
}
