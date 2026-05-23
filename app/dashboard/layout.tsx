import { createClient } from "@/lib/supabase/server";
import { Shell } from "./shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <Shell email={user?.email ?? null}>{children}</Shell>;
}
