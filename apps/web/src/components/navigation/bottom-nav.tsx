"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { Bookmark, ClipboardList, Flag, Home, Plus } from "lucide-react";
import { AddActionTrigger } from "./add-action-trigger";

type NavIconKey = "home" | "transactions" | "goal" | "account";

type NavItem = {
  href: string;
  label: string;
  iconKey: NavIconKey;
};

type BottomNavProps = {
  items: NavItem[];
  addHref?: string;
  addAction?: {
    accountId: string;
    currency: string;
    locale: string;
    canEdit: boolean;
  };
};

const primaryColor = "hsl(var(--primary))";
const inactiveColor = "hsl(var(--muted-foreground))";
const shellBackgroundColor = "hsl(var(--background))";
const shellBorderColor = "hsl(var(--border))";
const navIconMap: Record<NavIconKey, typeof Home> = {
  home: Home,
  transactions: ClipboardList,
  goal: Flag,
  account: Bookmark,
};

function normalizePath(pathname: string, locale: string) {
  if (pathname.startsWith(`/${locale}`)) {
    const trimmed = pathname.slice(locale.length + 1);
    return trimmed.length > 0 ? trimmed : "/";
  }

  return pathname;
}

export function BottomNav({
  items,
  addHref = "/transactions?new=1",
  addAction,
}: BottomNavProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const locale = useLocale();
  const normalizedPath = normalizePath(pathname, locale);
  const leftItems = items.slice(0, 2);
  const rightItems = items.slice(2);

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t sm:hidden"
      style={{
        backgroundColor: shellBackgroundColor,
        borderColor: shellBorderColor,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-stretch justify-around">
        {leftItems.map((item) => {
          const isActive =
            item.href === "/"
              ? normalizedPath === "/"
              : normalizedPath.startsWith(item.href);
          const Icon = navIconMap[item.iconKey];

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-1 py-2 transition-opacity"
              style={{
                color: isActive ? primaryColor : inactiveColor,
              }}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}

        {addAction ? (
          <AddActionTrigger
            canEdit={addAction.canEdit}
            accountId={addAction.accountId}
            currency={addAction.currency}
            locale={addAction.locale}
            variant="bottom-nav"
          />
        ) : (
          <Link
            href={addHref}
            className="relative -mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
            aria-label={t("addTransaction.entryTitle")}
          >
            <Plus className="h-5 w-5" />
          </Link>
        )}

        {rightItems.map((item) => {
          const isActive =
            item.href === "/"
              ? normalizedPath === "/"
              : normalizedPath.startsWith(item.href);
          const Icon = navIconMap[item.iconKey];

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-1 py-2 transition-opacity"
              style={{
                color: isActive ? primaryColor : inactiveColor,
              }}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
