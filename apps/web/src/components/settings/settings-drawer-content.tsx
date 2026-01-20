"use client";

import Link from "next/link";
import type { AvatarColorToken, SettingsMenuVM } from "@poleursus/shared";
import { ActiveAccountSelector } from "@/components/settings/active-account-selector";
import { UserAvatar } from "@/components/user-avatar";
import { UserSignOutRow } from "@/components/settings/user-signout";
import { Card, CardContent } from "@/components/ui/card";

type AccountSummary = {
  id: string;
  name: string;
  base_currency: string;
  memberCount: number;
};

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
  accounts: AccountSummary[];
  activeAccountId: string;
  menu: SettingsMenuVM;
  actionsLabel: string;
  onNavigate?: () => void;
};

export function SettingsDrawerContent({
  profile,
  accounts,
  activeAccountId,
  menu,
  actionsLabel,
  onNavigate,
}: SettingsDrawerContentProps) {
  const displayName = profile.displayName?.trim() || null;
  const primaryLabel = displayName ?? profile.email;
  const secondaryLabel = displayName ? profile.email : null;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5">
      <div className="space-y-6">
        {menu.sections.map((section) => {
          const showProfile = section.id === "user";
          const showAccountSelector =
            section.id === "account" && accounts.length > 0;

          return (
            <section key={section.id} className="space-y-3">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.title}
              </h2>
              <Card>
                <CardContent className="divide-y p-0">
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

                  {showAccountSelector && (
                    <div className="p-4">
                      <ActiveAccountSelector
                        accounts={accounts}
                        initialActiveAccountId={activeAccountId}
                        onAccountSelected={onNavigate}
                      />
                    </div>
                  )}

                  {section.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.route}
                      onClick={onNavigate}
                      className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          {item.title}
                        </div>
                      <div className="text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      </div>
                      <span className="text-lg text-muted-foreground">{">"}</span>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </section>
          );
        })}

        <section className="space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {actionsLabel}
          </h2>
          <Card>
            <CardContent className="p-4">
              <UserSignOutRow />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
