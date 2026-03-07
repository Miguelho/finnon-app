"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Loader2 } from "lucide-react";
import {
  computePendingMonthCloseKeysFromMonthCloses,
  formatMonthLabel,
  toMonthKey,
} from "@poleursus/shared";
import { createClient } from "@/lib/supabase/client";

type MonthCloseNotificationItem = {
  id: string;
  kind: "month-close";
  monthKey: string;
  title: string;
  subtitle: string;
};

type ActivityNotificationItem = {
  id: string;
  kind: "activity";
  userInitial: string;
  userName: string;
  count: number;
  timeAgo: string;
};

export type NotificationItem = MonthCloseNotificationItem | ActivityNotificationItem;

type NotificationDropdownProps = {
  userId: string;
  accountId: string;
  locale: string;
  viewHref?: string;
};

function formatTimeAgo(date: Date, locale: string): string {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const isEs = locale.startsWith("es");

  if (diffMinutes < 1) {
    return isEs ? "Hace unos segundos" : "Just now";
  }
  if (diffMinutes < 60) {
    return isEs ? `Hace ${diffMinutes} min` : `${diffMinutes} min ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return isEs
      ? `Hace ${diffHours} hora${diffHours === 1 ? "" : "s"}`
      : `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return isEs
    ? `Hace ${diffDays} día${diffDays === 1 ? "" : "s"}`
    : `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export function NotificationDropdown({
  userId,
  accountId,
  locale,
  viewHref = "/transactions",
}: NotificationDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const loadActivity = useCallback(async () => {
    if (!accountId || !userId) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const isEs = locale.startsWith("es");

      const currentMonthKey = toMonthKey(new Date());
      const [{ data: projectRows }, { data: monthClosesRows }] = await Promise.all([
        supabase
          .from("projects")
          .select("id, created_at")
          .eq("account_id", accountId)
          .not("target_amount_base_minor", "is", null)
          .eq("status", "active"),
        supabase
          .from("month_closes")
          .select("period")
          .eq("account_id", accountId),
      ]);

      const pendingMonthKeys = computePendingMonthCloseKeysFromMonthCloses({
        commitmentProjects: (projectRows ?? []).map((project) => ({
          projectId: project.id,
          createdAt: project.created_at ?? null,
        })),
        closedMonths: (monthClosesRows ?? []).map((row) => ({ period: row.period })),
        currentMonthKey,
      });

      let monthCloseNotification: MonthCloseNotificationItem | null = null;
      if (pendingMonthKeys.length > 0) {
        const pendingMonthKey = pendingMonthKeys[0]!;
        const monthLabel = formatMonthLabel(pendingMonthKey, locale);
        monthCloseNotification = {
          id: `month-close-${pendingMonthKey}`,
          kind: "month-close",
          monthKey: pendingMonthKey,
          title: isEs
            ? `Cierre mensual pendiente (${monthLabel})`
            : `Pending month close (${monthLabel})`,
          subtitle: isEs
            ? "Confirma el reparto del ahorro de ese mes."
            : "Confirm that month's savings allocation.",
        };
      }

      const since = new Date();
      since.setDate(since.getDate() - 7);

      const { data: rows } = await supabase
        .from("transactions")
        .select("id, created_by, created_at")
        .eq("account_id", accountId)
        .gte("created_at", since.toISOString())
        .neq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      const byUser = new Map<string, { count: number; latest: Date }>();
      for (const row of rows ?? []) {
        if (!row.created_by) continue;
        const createdAt = new Date(row.created_at);
        const existing = byUser.get(row.created_by);
        if (existing) {
          existing.count += 1;
          if (createdAt > existing.latest) existing.latest = createdAt;
        } else {
          byUser.set(row.created_by, { count: 1, latest: createdAt });
        }
      }

      const userIds = Array.from(byUser.keys());
      const { data: profiles } =
        userIds.length > 0
          ? await supabase
              .from("profiles")
              .select("user_id, display_name, email")
              .in("user_id", userIds)
          : { data: [] };

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.user_id, p])
      );

      const activityItems: ActivityNotificationItem[] = userIds
        .map((uid) => {
          const activity = byUser.get(uid);
          if (!activity) return null;
          const profile = profileMap.get(uid);
          const userName =
            profile?.display_name ??
            profile?.email ??
            (locale.startsWith("es") ? "Usuario" : "User");
          const userInitial = (userName.trim().charAt(0) || "?").toUpperCase();
          return {
            id: uid,
            kind: "activity" as const,
            userInitial,
            userName,
            count: activity.count,
            timeAgo: formatTimeAgo(activity.latest, locale),
            _sortValue: activity.latest.getTime(),
          };
        })
        .filter(Boolean)
        .sort(
          (a, b) => ((b as any)._sortValue ?? 0) - ((a as any)._sortValue ?? 0)
        )
        .slice(0, 5)
        .map(({ _sortValue, ...rest }: any) => rest as ActivityNotificationItem);

      const nextNotifications: NotificationItem[] = monthCloseNotification
        ? [monthCloseNotification, ...activityItems]
        : activityItems;

      setNotifications(nextNotifications);
    } finally {
      setLoading(false);
    }
  }, [accountId, userId, locale]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) void loadActivity();
      return next;
    });
  }, [loadActivity]);

  const isEs = locale.startsWith("es");
  const title = isEs ? "Actividad de la cuenta" : "Account activity";
  const emptyText = isEs ? "No hay actividad reciente." : "No recent activity.";
  const addedWord = isEs ? "añadió" : "added";
  const movementsWord = isEs ? "movimientos" : "movements";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Notificaciones"
        aria-expanded={open}
      >
        <Mail className="h-[18px] w-[18px]" />
      </button>

      <div
        className={`absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] rounded-xl border border-border bg-popover shadow-lg transition-all ${
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-1 opacity-0"
        }`}
      >
        <div className="border-b border-border px-4 pb-2.5 pt-3.5 text-[13px] font-semibold text-popover-foreground">
          {title}
        </div>

        {loading ? (
          <div className="flex items-center justify-center px-4 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className="flex items-center gap-3 border-t border-border/50 px-4 py-3.5 transition-colors first:border-t-0 hover:bg-accent"
            >
              {notif.kind === "month-close" ? (
                <>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[14px] font-bold text-amber-700 dark:text-amber-400">
                    {"\u{1F4C5}"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-popover-foreground">
                      {notif.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {notif.subtitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      router.push("/projects/month-close");
                      setOpen(false);
                    }}
                    className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    {isEs ? "Abrir" : "Open"} →
                  </button>
                </>
              ) : (
                <>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[13px] font-bold text-primary">
                    {notif.userInitial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-popover-foreground">
                      {notif.userName} {addedWord}{" "}
                      <strong>
                        {notif.count} {movementsWord}
                      </strong>
                    </p>
                    <p className="text-[11px] text-muted-foreground">{notif.timeAgo}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(viewHref);
                      setOpen(false);
                    }}
                    className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    {isEs ? "Ver" : "View"} →
                  </button>
                </>
              )}
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        )}
      </div>
    </div>
  );
}
