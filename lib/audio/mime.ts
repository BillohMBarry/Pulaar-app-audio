import type { AllowedFileExt, AllowedMimeType } from "@/types/audio";

export const MAX_AUDIO_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface RecordingMimeChoice {
  recorderMimeType: string;
  canonicalMimeType: AllowedMimeType;
  fileExt: AllowedFileExt;
}

/**
 * Prefer audio/mp4 when supported (Safari/iOS & broad mobile compatibility),
 * then fall back to audio/webm;codecs=opus, audio/webm, and audio/ogg;codecs=opus.
 */
const RECORDING_MIME_CANDIDATES: RecordingMimeChoice[] = [
  {
    recorderMimeType: "audio/mp4",
    canonicalMimeType: "audio/mp4",
    fileExt: "mp4",
  },
  {
    recorderMimeType: "audio/webm;codecs=opus",
    canonicalMimeType: "audio/webm",
    fileExt: "webm",
  },
  {
    recorderMimeType: "audio/webm",
    canonicalMimeType: "audio/webm",
    fileExt: "webm",
  },
  {
    recorderMimeType: "audio/ogg;codecs=opus",
    canonicalMimeType: "audio/ogg",
    fileExt: "ogg",
  },
];

export function pickRecordingMimeChoice(): RecordingMimeChoice {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return RECORDING_MIME_CANDIDATES[1];
  }

  for (const candidate of RECORDING_MIME_CANDIDATES) {
    if (
      typeof MediaRecorder.isTypeSupported === "function" &&
      MediaRecorder.isTypeSupported(candidate.recorderMimeType)
    ) {
      return candidate;
    }
  }

  return RECORDING_MIME_CANDIDATES[1];
}

export function normalizeMimeType(
  rawMimeType: string | null | undefined,
  fileName?: string
): { mimeType: AllowedMimeType; fileExt: AllowedFileExt } | null {
  const cleanMime = (rawMimeType ?? "").split(";")[0].trim().toLowerCase();

  if (cleanMime === "audio/mp4" || cleanMime === "audio/x-m4a" || cleanMime === "audio/m4a") {
    return { mimeType: "audio/mp4", fileExt: "mp4" };
  }
  if (cleanMime === "audio/webm") {
    return { mimeType: "audio/webm", fileExt: "webm" };
  }
  if (cleanMime === "audio/mpeg" || cleanMime === "audio/mp3") {
    return { mimeType: "audio/mpeg", fileExt: "mp3" };
  }
  if (cleanMime === "audio/ogg") {
    return { mimeType: "audio/ogg", fileExt: "ogg" };
  }

  // Fallback to extension inspection for browsers that omit file.type on mobile
  const ext = fileName?.split(".").pop()?.trim().toLowerCase();
  if (ext === "mp4" || ext === "m4a") {
    return { mimeType: "audio/mp4", fileExt: "mp4" };
  }
  if (ext === "webm") {
    return { mimeType: "audio/webm", fileExt: "webm" };
  }
  if (ext === "mp3") {
    return { mimeType: "audio/mpeg", fileExt: "mp3" };
  }
  if (ext === "ogg") {
    return { mimeType: "audio/ogg", fileExt: "ogg" };
  }

  return null;
}

export function buildCacheBustedAudioUrl(
  publicUrl: string,
  updatedAt?: string | null
): string {
  if (!updatedAt) return publicUrl;
  const timestamp = Date.parse(updatedAt);
  if (Number.isNaN(timestamp)) return publicUrl;
  const separator = publicUrl.includes("?") ? "&" : "?";
  return `${publicUrl}${separator}v=${timestamp}`;
}
