import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { t } from "@/lib/strings";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-l border-border bg-panel/60 backdrop-blur-sm flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-bg font-bold">
              ت
            </div>
            <div>
              <div className="font-semibold text-sm">{t.appShort}</div>
              <div className="text-xs text-muted">{t.appName}</div>
            </div>
          </div>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-panel2 text-sm"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
            {t.navDashboard}
          </Link>
          <Link
            href="/dashboard/upload"
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-panel2 text-sm"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent2" />
            {t.navUpload}
          </Link>
        </nav>
        <div className="p-3 border-t border-border">
          {user && (
            <div className="text-xs text-muted mb-2 truncate" dir="ltr">
              {user.email}
            </div>
          )}
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
