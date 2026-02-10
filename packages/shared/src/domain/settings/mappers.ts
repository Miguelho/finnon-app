import type { CopyDictionary } from "../../copy";
import { t } from "../../copy";
import type {
  UserDetailsVM,
  InviteItemVM,
  SettingsInviteStatus,
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
  status?: "pending" | "accepted" | "rejected" | "revoked" | "expired" | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  responded_at?: string | null;
  invited_email?: string | null;
  accounts?: { name: string } | null;
  invitee_user_id?: string | null;
  invitee_email?: string | null;
};

export function mapUserToUserDetailsVM(user: RawUser): UserDetailsVM {
  return {
    email: user.email ?? "",
    userId: user.id,
    displayName: user.user_metadata?.name ?? null,
  };
}

function getInviteStatus(
  invite: RawInvite,
  now: Date = new Date()
): SettingsInviteStatus {
  if (invite.status === "revoked") return "revoked";
  if (invite.status === "rejected") return "rejected";
  if (invite.status === "accepted") return "accepted";

  if (invite.revoked_at) return "revoked";

  const isExpired = Boolean(invite.expires_at && new Date(invite.expires_at) < now);
  if (invite.status === "expired" || isExpired) return "expired";

  return "pending";
}

export function mapInviteToInviteItemVM(
  invite: RawInvite,
  now?: Date
): InviteItemVM {
  const status = getInviteStatus(invite, now);
  return {
    id: invite.id,
    accountName: invite.accounts?.name ?? "Unknown",
    invitedEmail: invite.invited_email ?? invite.invitee_email ?? null,
    role: invite.role,
    status,
    expiresAt: invite.expires_at ? new Date(invite.expires_at) : null,
    createdAt: new Date(invite.created_at),
    respondedAt: invite.responded_at ? new Date(invite.responded_at) : null,
    isActive: status === "pending",
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
  platform: "mobile" | "web",
  options?: {
    accountId?: string | null;
  }
): SettingsMenuVM {
  const baseRoute = platform === "mobile" ? "/(auth)/settings" : "/settings";
  const mobileAccountBaseRoute = `${baseRoute}/account`;
  const webAccountBaseRoute = options?.accountId
    ? `/account/${options.accountId}/settings`
    : "/settings/account";

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
            id: "general",
            title: t(
              dictionary,
              "settings.menu.sections.account.items.general.title"
            ),
            description: t(
              dictionary,
              "settings.menu.sections.account.items.general.description"
            ),
            route:
              platform === "mobile"
                ? `${mobileAccountBaseRoute}/general`
                : `${webAccountBaseRoute}/general`,
          },
          {
            id: "members",
            title: t(
              dictionary,
              "settings.menu.sections.account.items.members.title"
            ),
            description: t(
              dictionary,
              "settings.menu.sections.account.items.members.description"
            ),
            route:
              platform === "mobile"
                ? `${mobileAccountBaseRoute}/members`
                : `${webAccountBaseRoute}/members`,
          },
          {
            id: "categories",
            title: t(
              dictionary,
              "settings.menu.sections.account.items.categories.title"
            ),
            description: t(
              dictionary,
              "settings.menu.sections.account.items.categories.description"
            ),
            route:
              platform === "mobile"
                ? `${mobileAccountBaseRoute}/categories`
                : `${webAccountBaseRoute}/categories`,
          },
        ],
      },
    ],
  };
}
