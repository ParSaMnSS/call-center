import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CallsView } from "./calls-view";
import type { Call } from "@/lib/supabase/types";
import { t } from "@/lib/strings";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  const initial: Call[] = (data as Call[] | null) ?? [];

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">{t.dashboardTitle}</h1>
          <p className="text-muted text-xs md:text-sm mt-1">{t.dashboardSubtitle}</p>
        </div>
        <Link href="/dashboard/upload" className="btn btn-primary whitespace-nowrap text-sm">
          + {t.newUpload}
        </Link>
      </div>

      {error && (
        <div className="text-danger text-sm bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 mb-4">
          {error.message}
        </div>
      )}

      <CallsView initial={initial} />
    </div>
  );
}
