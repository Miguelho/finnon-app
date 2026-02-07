"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { themeTokens } from "@poleursus/shared";
import { cn } from "@/lib/utils";

type NavIconKey = "home" | "transactions" | "goal" | "account";

type NavItem = {
  href: string;
  label: string;
  iconKey?: NavIconKey;
};

type TopNavLinksProps = {
  items: NavItem[];
  className?: string;
};

const colors = themeTokens.light.colors;
function normalizePath(pathname: string, locale: string) {
  if (pathname.startsWith(`/${locale}`)) {
    const trimmed = pathname.slice(locale.length + 1);
    return trimmed.length > 0 ? trimmed : "/";
  }

  return pathname;
}

export function TopNavLinks({ items, className }: TopNavLinksProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const normalizedPath = normalizePath(pathname, locale);

  const renderNavLink = (item: NavItem) => {
    const isActive =
      item.href === "/"
        ? normalizedPath === "/"
        : normalizedPath.startsWith(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "rounded-md font-medium transition",
          "px-3 py-2 text-sm",
          isActive ? "opacity-100" : "hover:opacity-80"
        )}
        style={{
          backgroundColor: isActive ? colors.action.secondary : "transparent",
          color: isActive ? colors.text.primary : colors.text.secondary,
        }}
      >
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className={cn("hidden items-center gap-2 sm:flex", className)}
    >
      {items.map((item) => renderNavLink(item))}
    </nav>
  );
}
