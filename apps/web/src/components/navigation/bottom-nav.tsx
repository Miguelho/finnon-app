"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { Bookmark, ClipboardList, Flag, Home } from "lucide-react";
import { themeTokens } from "@poleursus/shared";

type NavIconKey = "home" | "transactions" | "goal" | "account";

type NavItem = {
  href: string;
  label: string;
  iconKey: NavIconKey;
};

type BottomNavProps = {
  items: NavItem[];
};

const colors = themeTokens.light.colors;
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

export function BottomNav({ items }: BottomNavProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const normalizedPath = normalizePath(pathname, locale);

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
      style={{
        backgroundColor: colors.bg.primary,
        borderColor: colors.state.neutral,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-stretch justify-around">
        {items.map((item) => {
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
                color: isActive ? colors.action.primary : colors.text.secondary,
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
