import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { createClient } from "@/lib/server";
import type { ClipStatus } from "@/types/audio";

const ALLOWED_ADMIN_STATUSES: ClipStatus[] = [
  "approved",
  "rejected",
  "draft",
  "flagged",
];

/**
 * PATCH /api/admin/clips — Approve, reject, or update review notes on a clip.
 */
export async function PATCH(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: { clipKey?: unknown; status?: unknown; reviewNote?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const clipKey = typeof body.clipKey === "string" ? body.clipKey.trim() : "";
  const status = typeof body.status === "string" ? (body.status as ClipStatus) : null;
  if (!clipKey || !status || !ALLOWED_ADMIN_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Invalid clip review parameters." },
      { status: 400 }
    );
  }

  const reviewNote =
    typeof body.reviewNote === "string" && body.reviewNote.trim()
      ? body.reviewNote.trim().slice(0, 500)
      : null;

  const supabase = await createClient();

  // Prevent approving a flagged row that has no uploaded audio yet
  if (status === "approved") {
    const { data: current } = await supabase
      .from("audio_clips")
      .select("public_url, storage_path")
      .eq("clip_key", clipKey)
      .maybeSingle();

    if (!current?.public_url || !current?.storage_path) {
      return NextResponse.json(
        { error: "Cannot approve an entry that has no audio recording yet." },
        { status: 400 }
      );
    }
  }

  const { data: clip, error } = await supabase
    .from("audio_clips")
    .update({
      status,
      review_note: reviewNote,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("clip_key", clipKey)
    .select("*")
    .single();

  if (error || !clip) {
    console.error("Failed to review clip:", error);
    return NextResponse.json(
      { error: "Could not update clip status." },
      { status: 500 }
    );
  }

  return NextResponse.json({ clip });
}

/**
 * DELETE /api/admin/clips — Delete a clip record and its Storage file.
 */
export async function DELETE(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const url = new URL(request.url);
  const clipKey = url.searchParams.get("clipKey")?.trim() ?? "";
  if (!clipKey) {
    return NextResponse.json({ error: "Missing clipKey." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("audio_clips")
    .select("storage_path")
    .eq("clip_key", clipKey)
    .maybeSingle();

  if (existing?.storage_path) {
    await supabase.storage.from("pular-audio").remove([existing.storage_path]);
  }

  const { error } = await supabase
    .from("audio_clips")
    .delete()
    .eq("clip_key", clipKey);

  if (error) {
    return NextResponse.json(
      { error: "Could not delete clip." },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: clipKey });
}
