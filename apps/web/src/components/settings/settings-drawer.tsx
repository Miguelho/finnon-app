"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AvatarColorToken, SettingsMenuVM } from "@poleursus/shared";
import { AvatarButton } from "@/components/user/avatar-button";
import { SettingsDrawerContent } from "@/components/settings/settings-drawer-content";
import { cn } from "@/lib/utils";

type SettingsDrawerProfile = {
  userId: string;
  email: string;
  displayName?: string | null;
  avatarPath?: string | null;
  fallbackText?: string | null;
  fallbackBgToken?: AvatarColorToken | null;
};

type SettingsDrawerProps = {
  settingsLabel: string;
  openLabel: string;
  actionsLabel: string;
  profile: SettingsDrawerProfile;
  menu: SettingsMenuVM;
};

export function SettingsDrawer({
  settingsLabel,
  openLabel,
  actionsLabel,
  profile,
  menu,
}: SettingsDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const tCommon = useTranslations("common");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <AvatarButton
          email={profile.email}
          userId={profile.userId}
          avatarPath={profile.avatarPath}
          fallbackText={profile.fallbackText}
          fallbackBgToken={profile.fallbackBgToken}
          ariaLabel={openLabel}
          title={settingsLabel}
        />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[90] bg-foreground/5",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-0 top-0 z-[100] flex h-full w-[min(360px,86vw)] flex-col border-r bg-background text-foreground shadow-xl outline-none",
            "transition-transform duration-200",
            "data-[state=open]:translate-x-0 data-[state=closed]:-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold">
                {settingsLabel}
              </DialogPrimitive.Title>
              {profile.displayName && (
                <p className="text-sm text-muted-foreground">{profile.displayName}</p>
              )}
            </div>
            <DialogPrimitive.Close
              className={cn(
                "inline-flex items-center justify-center rounded-md p-2 transition",
                "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">{tCommon("close")}</span>
            </DialogPrimitive.Close>
          </div>

          <SettingsDrawerContent
            profile={profile}
            menu={menu}
            actionsLabel={actionsLabel}
            onNavigate={() => setOpen(false)}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
