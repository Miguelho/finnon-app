import type { UserRole } from "../types";

export type UserDetailsVM = {
  email: string;
  userId: string;
  displayName?: string | null;
};

export type InviteStatus = "active" | "expired" | "revoked";

export type InviteItemVM = {
  id: string;
  accountName: string;
  role: UserRole;
  status: InviteStatus;
  expiresAt: Date | null;
  isTargeted: boolean;
  usesCount: number;
  maxUses: number | null;
  createdAt: Date;
  isActive: boolean;
};

export type SettingsMenuItem = {
  id: string;
  title: string;
  description: string;
  route: string;
};

export type SettingsSection = {
  id: string;
  title: string;
  items: SettingsMenuItem[];
};

export type SettingsMenuVM = {
  title: string;
  subtitle: string;
  sections: SettingsSection[];
};
