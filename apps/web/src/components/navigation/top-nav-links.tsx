"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { themeTokens } from "@poleursus/shared";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
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

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function TopNavLinks({ items, className }: TopNavLinksProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const normalizedPath = normalizePath(pathname, locale);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  // Close menu on route change
  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    if (isMenuOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isMenuOpen, closeMenu]);

  const renderNavLink = (item: NavItem, isMobile = false) => {
    const isActive =
      item.href === "/"
        ? normalizedPath === "/"
        : normalizedPath.startsWith(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        onClick={isMobile ? closeMenu : undefined}
        className={cn(
          "rounded-md font-medium transition",
          isMobile ? "block px-4 py-3 text-base" : "px-3 py-2 text-sm",
          isActive ? "opacity-100" : "hover:opacity-80"
        )}
        style={{
          backgroundColor: isActive ? colors.action.secondary : "transparent",
          color: isActive ? colors.text.primary : colors.text.secondary,
        }}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <>
      {/* Desktop navigation */}
      <nav
        aria-label="Primary"
        className={cn(
          "hidden items-center gap-2 md:flex",
          className
        )}
      >
        {items.map((item) => renderNavLink(item))}
      </nav>

      {/* Mobile hamburger button */}
      <button
        type="button"
        className="flex items-center justify-center rounded-md p-2 md:hidden"
        style={{ color: colors.text.primary }}
        onClick={() => setIsMenuOpen(true)}
        aria-label="Open menu"
        aria-expanded={isMenuOpen}
        aria-controls="mobile-menu"
      >
        <MenuIcon />
      </button>

      {/* Mobile sidebar overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <div
        id="mobile-menu"
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-64 transform transition-transform duration-200 ease-in-out md:hidden",
          isMenuOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{
          backgroundColor: colors.bg.primary,
          borderLeft: `1px solid ${colors.state.neutral}`,
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: colors.state.neutral }}
        >
          <span
            className="text-sm font-medium"
            style={{ color: colors.text.primary }}
          >
            Menu
          </span>
          <button
            type="button"
            className="rounded-md p-2"
            style={{ color: colors.text.primary }}
            onClick={closeMenu}
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>
        <nav aria-label="Mobile navigation" className="flex flex-col py-2">
          {items.map((item) => renderNavLink(item, true))}
        </nav>
      </div>
    </>
  );
}
