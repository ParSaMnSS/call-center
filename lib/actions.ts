"use server";

import { createClient } from "@/lib/supabase/server";
import { claimAndProcessNext } from "@/lib/process";
import { revalidatePath } from "next/cache";

export async function deleteCall(id: string): Promise<{ error?: string }> {
	const sb = await createClient();

	// Get the audio path so we can delete the storage object too
	const { data: row } = await sb
		.from("calls")
		.select("audio_path")
		.eq("id", id)
		.single();

	// Delete storage file (ignore errors — DB delete is the source of truth)
	if (row?.audio_path && row.audio_path !== "pending") {
		await sb.storage.from("call-audio").remove([row.audio_path]);
	}

	// `select()` after delete returns the deleted rows. If the array is
	// empty, the row wasn't deleted — usually an RLS policy mismatch.
	const { data: deleted, error } = await sb
		.from("calls")
		.delete()
		.eq("id", id)
		.select("id");
	if (error) return { error: error.message };
	if (!deleted || deleted.length === 0) {
		return { error: "حذف ناموفق بود (دسترسی ندارید یا قبلاً حذف شده است)" };
	}

	revalidatePath("/dashboard");
	return {};
}

export async function cancelCall(id: string): Promise<{ error?: string }> {
	const sb = await createClient();

	// Only cancellable while still processing
	const { data: row } = await sb
		.from("calls")
		.select("status")
		.eq("id", id)
		.single();

	if (!row) return { error: "تماس یافت نشد" };
	if (row.status === "done" || row.status === "failed") {
		return { error: "این تماس قابل لغو نیست" };
	}

	const { error } = await sb
		.from("calls")
		.update({
			status: "failed",
			error_message: "لغو شده توسط کاربر",
		})
		.eq("id", id);

	if (error) return { error: error.message };
	revalidatePath("/dashboard");
	return {};
}

// Flip every failed call back to pending and kick the worker. Used by the
// dashboard "Analyze all failed" button. Also clears any audio_path === 'pending'
// guard issues since failed rows always have a real path by this point.
export async function retryAllFailed(): Promise<{ count: number; error?: string }> {
	const sb = await createClient();

	const { data, error } = await sb
		.from("calls")
		.update({
			status: "pending",
			processing_started_at: null,
			error_message: null,
		})
		.eq("status", "failed")
		.select("id");

	if (error) return { count: 0, error: error.message };

	// Kick the serial worker (no-op if nothing pending).
	try {
		await claimAndProcessNext();
	} catch (e) {
		console.error("[retryAllFailed] kick failed:", e);
	}

	revalidatePath("/dashboard");
	return { count: data?.length ?? 0 };
}

// Cancel every in-flight call (pending + analyzing + transcribing). Used by
// the dashboard "Stop all" button. The currently-running Gemini call can't
// actually be interrupted mid-flight, but processCall checks isAborted()
// before writing results, so its output gets discarded.
export async function cancelAllProcessing(): Promise<{ count: number; error?: string }> {
	const sb = await createClient();

	const { data, error } = await sb
		.from("calls")
		.update({
			status: "failed",
			error_message: "لغو دسته‌جمعی توسط کاربر",
		})
		.in("status", ["pending", "analyzing", "transcribing"])
		.select("id");

	if (error) return { count: 0, error: error.message };

	revalidatePath("/dashboard");
	return { count: data?.length ?? 0 };
}
