"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Globe, Settings, Tags, UserRound, Users } from "lucide-react";
import type { AvatarColorToken, SettingsMenuVM } from "@poleursus/shared";
import { UserAvatar } from "@/components/user-avatar";
import { UserSignOutRow } from "@/components/settings/user-signout";

type SettingsDrawerProfile = {
  userId: string;
  email: string;
  displayName?: string | null;
  avatarPath?: string | null;
  fallbackText?: string | null;
  fallbackBgToken?: AvatarColorToken | null;
};

type SettingsDrawerContentProps = {
  profile: SettingsDrawerProfile;
  menu: SettingsMenuVM;
  actionsLabel: string;
  onNavigate?: () => void;
};

export function SettingsDrawerContent({
  profile,
  menu,
  actionsLabel,
  onNavigate,
}: SettingsDrawerContentProps) {
  const pathname = usePathname();
  const displayName = profile.displayName?.trim() || null;
  const primaryLabel = displayName ?? profile.email;
  const secondaryLabel = displayName ? profile.email : null;

  const resolveIcon = (itemId: string) => {
    switch (itemId) {
      case "user-details":
        return UserRound;
      case "language":
        return Globe;
      case "general":
        return Settings;
      case "members":
        return Users;
      case "categories":
        return Tags;
      default:
        return Settings;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5">
      <div className="space-y-6">
        {menu.sections.map((section) => {
          const showProfile = section.id === "user";

          return (
            <section key={section.id} className="space-y-3">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.title}
              </h2>
              <div className="divide-y border-y border-muted">
                {showProfile && (
                  <div className="flex items-center gap-3 p-4">
                    <UserAvatar
                      email={profile.email}
                      userId={profile.userId}
                      avatarPath={profile.avatarPath}
                      fallbackText={profile.fallbackText}
                      fallbackBgToken={profile.fallbackBgToken}
                      size={52}
                      label={primaryLabel}
                    />
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {primaryLabel}
                      </p>
                      {secondaryLabel && (
                        <p className="truncate text-xs text-muted-foreground">
                          {secondaryLabel}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {section.items.map((item) => {
                  const ItemIcon = resolveIcon(item.id);
                  const isActive =
                    pathname === item.route ||
                    pathname.startsWith(`${item.route}/`);

                  return (
                    <Link
                      key={item.id}
                      href={item.route}
                      onClick={onNavigate}
                      className={`flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/50 ${
                        isActive ? "bg-muted/70" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                            isActive
                              ? "bg-background text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          <ItemIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div
                            className={`text-sm ${
                              isActive
                                ? "font-semibold text-foreground"
                                : "font-medium text-foreground"
                            }`}
                          >
                            {item.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {actionsLabel}
          </h2>
          <div className="border-y border-muted p-4">
            <UserSignOutRow />
          </div>
        </section>
      </div>
    </div>
  );
}
