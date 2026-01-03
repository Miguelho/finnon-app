import type { CopyDictionary } from "../../copy";
import { t } from "../../copy";
import type {
  UserDetailsVM,
  InviteItemVM,
  InviteStatus,
  SettingsMenuVM,
} from "./types";

/**
 * Raw user shape from Supabase Auth
 */
type RawUser = {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
  };
};

/**
 * Raw invite shape from database
 */
type RawInvite = {
  id: string;
  account_id: string;
  role: "viewer" | "contributor" | "admin";
  expires_at: string;
  revoked_at: string | null;
  max_uses: number | null;
  uses_count: number;
  created_at: string;
  accounts?: { name: string } | null;
};

export function mapUserToUserDetailsVM(user: RawUser): UserDetailsVM {
  return {
    email: user.email ?? "",
    userId: user.id,
    displayName: user.user_metadata?.name ?? null,
  };
}

function getInviteStatus(invite: RawInvite, now: Date = new Date()): InviteStatus {
  if (invite.revoked_at) return "revoked";
  if (new Date(invite.expires_at) < now) return "expired";
  if (invite.max_uses !== null && invite.uses_count >= invite.max_uses)
    return "expired";
  return "active";
}

export function mapInviteToInviteItemVM(
  invite: RawInvite,
  now?: Date
): InviteItemVM {
  const status = getInviteStatus(invite, now);
  return {
    id: invite.id,
    accountName: invite.accounts?.name ?? "Unknown",
    role: invite.role,
    status,
    expiresAt: new Date(invite.expires_at),
    usesCount: invite.uses_count,
    maxUses: invite.max_uses,
    createdAt: new Date(invite.created_at),
    isActive: status === "active",
  };
}

export function mapInvitesToInvitesVM(
  invites: RawInvite[],
  now?: Date
): InviteItemVM[] {
  return invites.map((invite) => mapInviteToInviteItemVM(invite, now));
}

export function buildSettingsMenuVM(
  dictionary: CopyDictionary,
  platform: "mobile" | "web"
): SettingsMenuVM {
  const baseRoute = platform === "mobile" ? "/(auth)/settings" : "/settings";

  return {
    title: t(dictionary, "settings.title"),
    subtitle: t(dictionary, "settings.subtitle"),
    sections: [
      {
        id: "user",
        title: t(dictionary, "settings.menu.sections.user.title"),
        items: [
          {
            id: "user-details",
            title: t(dictionary, "settings.menu.sections.user.items.details.title"),
            description: t(
              dictionary,
              "settings.menu.sections.user.items.details.description"
            ),
            route:
              platform === "mobile"
                ? `${baseRoute}/user-details`
                : `${baseRoute}/user`,
          },
          {
            id: "language",
            title: t(dictionary, "settings.menu.sections.user.items.language.title"),
            description: t(
              dictionary,
              "settings.menu.sections.user.items.language.description"
            ),
            route: `${baseRoute}/language`,
          },
        ],
      },
      {
        id: "account",
        title: t(dictionary, "settings.menu.sections.account.title"),
        items: [
          {
            id: "invitations",
            title: t(
              dictionary,
              "settings.menu.sections.account.items.invitations.title"
            ),
            description: t(
              dictionary,
              "settings.menu.sections.account.items.invitations.description"
            ),
            route: `${baseRoute}/invitations`,
          },
        ],
      },
    ],
  };
}
