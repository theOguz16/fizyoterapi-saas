export type Role = "ADMIN" | "TRAINER" | "MEMBER";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  tenantId: string;
  tenantSlug: string;
  fullName: string;
};

export type AuthSessionSnapshot = {
  resolved: boolean;
  user: AuthUser | null;
};
