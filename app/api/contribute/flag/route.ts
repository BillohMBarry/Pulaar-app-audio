import { NextResponse } from "next/server";
import { getVerifiedContributorSession } from "@/lib/auth/contributor-session";
import { getPromptByClipKey } from "@/lib/curriculum";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/contribute/flag
 * Lets a native speaker skip/flag an item with a dialect or orthography note
 * for admin review without blocking their recording session.
 */
export async function POST(request: Request) {
  const session = await getVerifiedContributorSession();
  if (!session) {
    return NextResponse.json(
      { error: "Your recording session is invalid or has been revoked." },
      { status: 401 }
    );
  }

  let body: { clipKey?: unknown; dialectNote?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const clipKey = typeof body.clipKey === "string" ? body.clipKey.trim() : "";
  const prompt = getPromptByClipKey(clipKey);
  if (!prompt) {
    return NextResponse.json(
      { error: "Unknown vocabulary item." },
      { status: 400 }
    );
  }

  const dialectNote =
    typeof body.dialectNote === "string" ? body.dialectNote.trim().slice(0, 500) : "";
  if (!dialectNote) {
    return NextResponse.json(
      { error: "Please include a short note explaining the dialect or phrasing issue." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("audio_clips")
    .select("storage_path, public_url, mime_type, file_ext, duration_ms, file_size_bytes")
    .eq("clip_key", prompt.clipKey)
    .maybeSingle();

  const { data: savedClip, error } = await supabase
    .from("audio_clips")
    .upsert(
      {
        clip_key: prompt.clipKey,
        vocab_id: prompt.vocabId,
        is_plural: prompt.isPlural,
        competence: prompt.competence,
        status: "flagged",
        storage_path: existing?.storage_path ?? null,
        public_url: existing?.public_url ?? null,
        mime_type: existing?.mime_type ?? null,
        file_ext: existing?.file_ext ?? null,
        duration_ms: existing?.duration_ms ?? null,
        file_size_bytes: existing?.file_size_bytes ?? null,
        dialect_note: dialectNote,
        invite_id: session.inviteId,
        speaker_name: session.speakerName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clip_key" }
    )
    .select("*")
    .single();

  if (error || !savedClip) {
    console.error("Failed to flag clip:", error);
    return NextResponse.json(
      { error: "Could not save your dialect note. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ clip: savedClip });
}
