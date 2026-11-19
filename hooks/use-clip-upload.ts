"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/client";
import type { CapturedTake } from "@/hooks/use-audio-recorder";
import type { AudioClipRow } from "@/types/audio";

export interface UploadResult {
  clip: AudioClipRow | null;
  error: string | null;
}

/**
 * Direct-to-Supabase-Storage signed upload workflow:
 * 1) POST /api/contribute/upload-url (server validates HttpOnly invite cookie & issues signed upload token)
 * 2) Browser uploads Blob directly to Supabase Storage via uploadToSignedUrl
 * 3) POST /api/contribute/clips (server saves draft metadata row in public.audio_clips)
 *
 * Keeps the recorded Blob intact in memory if any step fails on weak mobile data
 * so the speaker can tap "Retry Upload" without re-recording.
 */
export function useClipUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadTake = useCallback(
    async (params: {
      clipKey: string;
      take: CapturedTake;
      dialectNote?: string;
    }): Promise<UploadResult> => {
      const { clipKey, take, dialectNote } = params;
      setIsUploading(true);
      setUploadError(null);

      try {
        // Step 1: Request signed upload URL
        const urlRes = await fetch("/api/contribute/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clipKey,
            mimeType: take.mimeType,
            fileName: take.fileName,
            fileSizeBytes: take.blob.size,
          }),
        });

        const urlPayload = (await urlRes.json().catch(() => ({}))) as {
          path?: string;
          token?: string;
          mimeType?: string;
          error?: string;
        };

        if (!urlRes.ok || !urlPayload.path || !urlPayload.token) {
          const message =
            urlPayload.error ??
            "Could not connect to upload server. Check your connection and tap Retry Upload.";
          setUploadError(message);
          return { clip: null, error: message };
        }

        // Step 2: Direct browser upload to Supabase Storage signed URL
        const supabase = createClient();
        const { error: storageError } = await supabase.storage
          .from("pular-audio")
          .uploadToSignedUrl(urlPayload.path, urlPayload.token, take.blob, {
            contentType: urlPayload.mimeType ?? take.mimeType,
          });

        if (storageError) {
          const message =
            "Upload was interrupted on your network. Your recording is safe — tap Retry Upload.";
          setUploadError(message);
          return { clip: null, error: message };
        }

        // Step 3: Save draft metadata row in public.audio_clips
        const saveRes = await fetch("/api/contribute/clips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clipKey,
            storagePath: urlPayload.path,
            mimeType: urlPayload.mimeType ?? take.mimeType,
            durationMs: take.durationMs,
            fileSizeBytes: take.blob.size,
            dialectNote: dialectNote?.trim() || undefined,
          }),
        });

        const savePayload = (await saveRes.json().catch(() => ({}))) as {
          clip?: AudioClipRow;
          error?: string;
        };

        if (!saveRes.ok || !savePayload.clip) {
          const message =
            savePayload.error ??
            "Audio uploaded, but saving failed. Tap Retry Upload.";
          setUploadError(message);
          return { clip: null, error: message };
        }

        return { clip: savePayload.clip, error: null };
      } catch {
        const message =
          "Network connection dropped. Your recording is still saved on screen — tap Retry Upload when ready.";
        setUploadError(message);
        return { clip: null, error: message };
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  const clearUploadError = useCallback(() => {
    setUploadError(null);
  }, []);

  return {
    isUploading,
    uploadError,
    uploadTake,
    clearUploadError,
  };
}
