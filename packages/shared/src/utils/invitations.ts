import type { MemberRole } from "../schemas/invite";

const ROLE_LABELS = {
  es: {
    viewer: "Solo ver",
    contributor: "Puede añadir",
    admin: "Admin",
  },
  en: {
    viewer: "View only",
    contributor: "Can add",
    admin: "Admin",
  },
} as const;

export function humanizeRole(
  role: MemberRole,
  locale: keyof typeof ROLE_LABELS = "es"
): string {
  return ROLE_LABELS[locale]?.[role] ?? ROLE_LABELS.es[role];
}

export function isExpired(
  expiresAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!expiresAt) return false;
  const expires = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return expires.getTime() < now.getTime();
}
