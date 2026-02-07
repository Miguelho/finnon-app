"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";

export type NotificationItem = {
  id: string;
  userInitial: string;
  userName: string;
  count: number;
  timeAgo: string;
};

type NotificationDropdownProps = {
  notifications: NotificationItem[];
  viewHref?: string;
};

export function NotificationDropdown({
  notifications,
  viewHref = "/transactions",
}: NotificationDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  const unreadCount = notifications?.length ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
        aria-label="Notificaciones"
        aria-expanded={open}
      >
        <Mail className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-red-600 text-[9px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      <div
        className={`absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] rounded-xl border border-gray-200 bg-white shadow-lg transition-all ${
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-1 opacity-0"
        }`}
      >
        <div className="border-b border-gray-100 px-4 pb-2.5 pt-3.5 text-[13px] font-semibold text-gray-900">
          Actividad de la cuenta
        </div>

        {notifications?.length > 0 ? (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className="flex items-center gap-3 border-t border-gray-50 px-4 py-3.5 transition-colors first:border-t-0 hover:bg-gray-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50 text-[13px] font-bold text-purple-600">
                {notif.userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-gray-900">
                  {notif.userName} añadió{" "}
                  <strong>{notif.count} movimientos</strong>
                </p>
                <p className="text-[11px] text-gray-400">{notif.timeAgo}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  router.push(viewHref);
                  setOpen(false);
                }}
                className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
              >
                Ver →
              </button>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            No hay actividad reciente.
          </div>
        )}
      </div>
    </div>
  );
}
