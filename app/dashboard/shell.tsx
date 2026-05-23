"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "./logout-button";
import { ToastProvider } from "@/components/toast";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { t } from "@/lib/strings";

export function Shell({ children, email }: { children: React.ReactNode; email: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navItems = [
    { href: "/dashboard", label: t.navDashboard, dot: "bg-accent" },
    { href: "/dashboard/upload", label: t.navUpload, dot: "bg-accent2" },
  ];

  const Sidebar = (
    <aside className="w-64 shrink-0 border-l border-border bg-panel/60 backdrop-blur-sm flex flex-col h-screen">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-bg font-bold">
            ت
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{t.appShort}</div>
            <div className="text-xs text-muted truncate">{t.appName}</div>
          </div>
        </div>
      </div>
      <nav className="p-3 space-y-1 flex-1">
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
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition " +
                (active ? "bg-panel2 text-text" : "text-muted hover:text-text hover:bg-panel2/60")
              }
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${item.dot}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        {email && <div className="text-xs text-muted mb-2 truncate" dir="ltr">{email}</div>}
        <LogoutButton />
      </div>
    </aside>
  );

  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="min-h-screen flex">
          {/* Desktop sidebar */}
          <div className="hidden md:block sticky top-0 self-start">{Sidebar}</div>

          {/* Mobile drawer */}
          {open && (
            <div className="md:hidden fixed inset-0 z-40">
              <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
              <div className="absolute inset-y-0 right-0">{Sidebar}</div>
            </div>
          )}

          {/* Main */}
          <main className="flex-1 min-w-0">
            {/* Mobile top bar */}
            <div className="md:hidden sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-sm">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setOpen(true)}
                  className="btn btn-ghost p-2"
                  aria-label="menu"
                >
                  ≡
                </button>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-bg font-bold text-sm">ت</div>
                  <div className="text-sm font-semibold">{t.appShort}</div>
                </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-5 md:p-8">{children}</div>
          </main>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
