import { NextResponse } from "next/server";
import { getVerifiedContributorSession } from "@/lib/auth/contributor-session";
import { getPromptByClipKey } from "@/lib/curriculum";
import {
  MAX_AUDIO_FILE_SIZE_BYTES,
  normalizeMimeType,
} from "@/lib/audio/mime";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/contribute/upload-url
 * Generates a short-lived Supabase Storage signed upload URL (with upsert: true)
 * so invited speakers upload audio blobs directly from their browser to Storage.
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
    mimeType?: unknown;
    fileName?: unknown;
    fileSizeBytes?: unknown;
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
    typeof body.fileName === "string" ? body.fileName : undefined
  );
  if (!normalized) {
    return NextResponse.json(
      {
        error:
          "Unsupported audio format. Please record in browser or upload .mp4, .webm, .mp3, or .ogg.",
      },
      { status: 400 }
    );
  }

  const fileSizeBytes =
    typeof body.fileSizeBytes === "number" ? body.fileSizeBytes : 0;
  if (fileSizeBytes <= 0 || fileSizeBytes > MAX_AUDIO_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Audio clip must be between 1 byte and 5 MB." },
      { status: 400 }
    );
  }

  const storagePath = `vocab/comp-${prompt.competence}/${prompt.clipKey}.${normalized.fileExt}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("pular-audio")
    .createSignedUploadUrl(storagePath, {
      upsert: true, // Must be set on createSignedUploadUrl (not uploadToSignedUrl)
    });

  if (error || !data) {
    console.error("createSignedUploadUrl failed:", error);
    return NextResponse.json(
      { error: "Could not prepare audio upload. Please try again." },
      { status: 500 }
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from("pular-audio")
    .getPublicUrl(storagePath);

  return NextResponse.json({
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: publicUrlData.publicUrl,
    mimeType: normalized.mimeType,
    fileExt: normalized.fileExt,
  });
}
