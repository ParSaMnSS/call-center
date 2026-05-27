import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Call } from "@/lib/supabase/types";
import { CallDetail } from "./call-detail";
import { t } from "@/lib/strings";

export const dynamic = "force-dynamic";

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await createClient();

  const { data: call } = await sb
    .from("calls")
    .select("*")
    .eq("id", id)
    .single();

  if (!call) notFound();

  // Signed URL for audio playback
  let audioUrl: string | null = null;
  if ((call as Call).audio_path && (call as Call).audio_path !== "pending") {
    const { data: signed } = await sb.storage
      .from("call-audio")
      .createSignedUrl((call as Call).audio_path, 60 * 60);
    audioUrl = signed?.signedUrl ?? null;
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/dashboard" className="text-sm text-muted hover:text-fg inline-flex items-center gap-1.5 transition-colors">
          <ArrowRight className="w-4 h-4" />
          {t.back}
        </Link>
      </div>
      <CallDetail initial={call as Call} audioUrl={audioUrl} />
    </div>
  );
}
