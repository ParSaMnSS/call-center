"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { t } from "@/lib/strings";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button onClick={logout} className="btn w-full text-sm">
      {t.navLogout}
    </button>
  );
}
