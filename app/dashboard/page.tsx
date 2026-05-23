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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t.dashboardTitle}</h1>
          <p className="text-muted text-sm mt-1">{t.dashboardSubtitle}</p>
        </div>
        <Link href="/dashboard/upload" className="btn btn-primary">
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
