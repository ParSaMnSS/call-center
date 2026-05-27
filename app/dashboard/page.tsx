import { createClient } from "@/lib/supabase/server";
import { CallsView } from "./calls-view";
import type { Call } from "@/lib/supabase/types";

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
      {error && (
        <div className="text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2 mb-4">
          {error.message}
        </div>
      )}
      <CallsView initial={initial} />
    </div>
  );
}
