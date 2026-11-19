import { NextResponse } from "next/server";
import { getVerifiedContributorSession } from "@/lib/auth/contributor-session";
import { getPromptByClipKey } from "@/lib/curriculum";
import {
  MAX_AUDIO_FILE_SIZE_BYTES,
  normalizeMimeType,
} from "@/lib/audio/mime";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/contribute/clips
 * Confirms a completed signed-URL Storage upload and saves the clip metadata
 * into public.audio_clips as status = 'draft'.
 */
export async function POST(request: Request) {
  const session = await getVerifiedContributorSession();
  if (!session) {
    return NextResponse.json(
      { error: "Your recording session is invalid or has been revoked." },
      { status: 401 }
    );
  }

  let body: {
    clipKey?: unknown;
    storagePath?: unknown;
    mimeType?: unknown;
    durationMs?: unknown;
    fileSizeBytes?: unknown;
    dialectNote?: unknown;
  };
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

  const normalized = normalizeMimeType(
    typeof body.mimeType === "string" ? body.mimeType : null,
    typeof body.storagePath === "string" ? body.storagePath : undefined
  );
  if (!normalized) {
    return NextResponse.json(
      { error: "Unsupported audio MIME type." },
      { status: 400 }
    );
  }

  const expectedStoragePath = `vocab/comp-${prompt.competence}/${prompt.clipKey}.${normalized.fileExt}`;
  if (body.storagePath !== expectedStoragePath) {
    return NextResponse.json(
      { error: "Storage path mismatch." },
      { status: 400 }
    );
  }

  const rawDuration =
    typeof body.durationMs === "number" ? Math.round(body.durationMs) : null;
  const durationMs =
    rawDuration !== null && rawDuration > 0 && rawDuration <= 60000
      ? rawDuration
      : null;

  const rawSize =
    typeof body.fileSizeBytes === "number"
      ? Math.round(body.fileSizeBytes)
      : null;
  const fileSizeBytes =
    rawSize !== null && rawSize > 0 && rawSize <= MAX_AUDIO_FILE_SIZE_BYTES
      ? rawSize
      : null;

  const dialectNote =
    typeof body.dialectNote === "string" && body.dialectNote.trim().length > 0
      ? body.dialectNote.trim().slice(0, 500)
      : null;

  const supabase = createAdminClient();

  // Check if an existing clip used a different file extension so we clean up orphans
  const { data: existing } = await supabase
    .from("audio_clips")
    .select("storage_path, dialect_note")
    .eq("clip_key", prompt.clipKey)
    .maybeSingle();

  const { data: publicUrlData } = supabase.storage
    .from("pular-audio")
    .getPublicUrl(expectedStoragePath);

  const nowIso = new Date().toISOString();
  const { data: savedClip, error: upsertError } = await supabase
    .from("audio_clips")
    .upsert(
      {
        clip_key: prompt.clipKey,
        vocab_id: prompt.vocabId,
        is_plural: prompt.isPlural,
        competence: prompt.competence,
        status: "draft",
        storage_path: expectedStoragePath,
        public_url: publicUrlData.publicUrl,
        mime_type: normalized.mimeType,
        file_ext: normalized.fileExt,
        duration_ms: durationMs,
        file_size_bytes: fileSizeBytes,
        dialect_note: dialectNote ?? existing?.dialect_note ?? null,
        invite_id: session.inviteId,
        speaker_name: session.speakerName,
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
        updated_at: nowIso,
      },
      { onConflict: "clip_key" }
    )
    .select("*")
    .single();

  if (upsertError || !savedClip) {
    console.error("Failed to save audio_clips row:", upsertError);
    return NextResponse.json(
      { error: "Audio uploaded, but saving metadata failed. Please retry." },
      { status: 500 }
    );
  }

  // Clean up old file if extension changed (e.g. .webm replaced by .mp4)
  if (
    existing?.storage_path &&
    existing.storage_path !== expectedStoragePath
  ) {
    await supabase.storage
      .from("pular-audio")
      .remove([existing.storage_path]);
  }

  return NextResponse.json({ clip: savedClip });
}
