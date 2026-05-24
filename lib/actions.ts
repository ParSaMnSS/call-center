"use server";

import { createClient } from "@/lib/supabase/server";
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
