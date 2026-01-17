import type { UserRole } from "../types";

export type UserDetailsVM = {
  email: string;
  userId: string;
  displayName?: string | null;
};

export type SettingsInviteStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "revoked"
  | "expired";

export type InviteItemVM = {
  id: string;
  accountName: string;
  invitedEmail: string | null;
  role: UserRole;
  status: SettingsInviteStatus;
  expiresAt: Date | null;
  createdAt: Date;
  respondedAt: Date | null;
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
