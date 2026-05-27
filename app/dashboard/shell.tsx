"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { LogoutButton } from "./logout-button";
import { ToastProvider } from "@/components/toast";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { ConnectionIndicator } from "@/components/connection-indicator";
import { RealtimeProvider } from "@/lib/realtime-context";
import { t } from "@/lib/strings";

export function Shell({ children, email }: { children: React.ReactNode; email: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navItems = [
    { href: "/dashboard", label: t.navDashboard },
    { href: "/dashboard/summary", label: t.navSummary },
    { href: "/dashboard/upload", label: t.navUpload },
  ];

  const Sidebar = (
    <aside className="w-64 shrink-0 border-l border-border bg-surface flex flex-col h-screen">
      <div className="p-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-fg flex items-center justify-center text-white font-bold">
            ت
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{t.appShort}</div>
            <div className="text-xs text-muted truncate">{t.appName}</div>
          </div>
        </Link>
      </div>
      <nav className="p-3 space-y-0.5 flex-1">
        {navItems.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={
                "flex items-center px-3 py-2 rounded-lg text-sm transition-colors " +
                (active
                  ? "bg-surface2 text-fg font-medium"
                  : "text-muted hover:text-fg hover:bg-surface2")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border space-y-2">
        <ConnectionIndicator />
        {email && <div className="text-xs text-muted truncate px-2" dir="ltr">{email}</div>}
        <LogoutButton />
      </div>
    </aside>
  );

  return (
    <ToastProvider>
      <ConfirmProvider>
        <RealtimeProvider>
        <div className="min-h-screen flex">
          {/* Desktop sidebar */}
          <div className="hidden md:block sticky top-0 self-start">{Sidebar}</div>

          {/* Mobile drawer */}
          {open && (
            <div className="md:hidden fixed inset-0 z-40">
              <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
              <div className="absolute inset-y-0 right-0">{Sidebar}</div>
            </div>
          )}

          {/* Main */}
          <main className="flex-1 min-w-0">
            {/* Mobile top bar */}
            <div className="md:hidden sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setOpen(true)}
                  className="btn btn-ghost p-2"
                  aria-label="menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-fg flex items-center justify-center text-white font-bold text-sm">ت</div>
                  <div className="text-sm font-semibold">{t.appShort}</div>
                </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-5 md:p-8">{children}</div>
          </main>
        </div>
        </RealtimeProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
