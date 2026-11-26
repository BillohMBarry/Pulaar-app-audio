"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Mic,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AudioPlayButton } from "@/components/audio/audio-play-button";
import {
  MAX_RECORDING_MS,
  useAudioRecorder,
} from "@/hooks/use-audio-recorder";
import { useClipUpload } from "@/hooks/use-clip-upload";
import { useHowlerPlayer } from "@/hooks/use-howler-player";
import type { AudioClipRow, RecordingPromptItem } from "@/types/audio";

interface AudioCaptureBarProps {
  prompt: RecordingPromptItem;
  existingClip: AudioClipRow | null;
  onSaved: (clip: AudioClipRow) => void;
  onAnnouncePolite: (msg: string) => void;
  onAnnounceAssertive: (msg: string) => void;
}

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function AudioCaptureBar({
  prompt,
  existingClip,
  onSaved,
  onAnnouncePolite,
  onAnnounceAssertive,
}: AudioCaptureBarProps) {
  const {
    recorderState,
    take,
    elapsedMs,
    inputLevel,
    micError,
    startRecording,
    stopRecording,
    loadManualFile,
    discardTake,
  } = useAudioRecorder();

  const { isUploading, uploadError, uploadTake, clearUploadError } =
    useClipUpload();
  const { stop: stopPlayback } = useHowlerPlayer();

  const [confirmOverwriteOpen, setConfirmOverwriteOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevClipKeyRef = useRef<string>(prompt.clipKey);

  // Reset recorder state cleanly whenever the speaker moves to a different prompt card
  useEffect(() => {
    if (prevClipKeyRef.current !== prompt.clipKey) {
      prevClipKeyRef.current = prompt.clipKey;
      stopPlayback();
      discardTake();
      clearUploadError();
    }
  }, [prompt.clipKey, stopPlayback, discardTake, clearUploadError]);

  useEffect(() => {
    if (micError) {
      onAnnounceAssertive(micError);
    }
  }, [micError, onAnnounceAssertive]);

  useEffect(() => {
    if (uploadError) {
      onAnnounceAssertive(uploadError);
    }
  }, [uploadError, onAnnounceAssertive]);

  const handleRecordClick = async () => {
    stopPlayback();
    clearUploadError();
    await startRecording();
    onAnnouncePolite(`Recording started for ${prompt.pularText}`);
  };

  const handleStopClick = () => {
    stopRecording();
    onAnnouncePolite(
      `Recording stopped for ${prompt.pularText}. You can preview or save.`
    );
  };

  const performUpload = async () => {
    if (!take) return;
    stopPlayback();
    const { clip, error } = await uploadTake({
      clipKey: prompt.clipKey,
      take,
    });
    if (error || !clip) {
      return;
    }
    discardTake();
    clearUploadError();
    onSaved(clip);
  };

  const handleSaveRequest = () => {
    if (!take) return;
    const hasExistingAudio = Boolean(existingClip?.public_url);
    if (hasExistingAudio && !uploadError) {
      setConfirmOverwriteOpen(true);
      return;
    }
    void performUpload();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    stopPlayback();
    clearUploadError();
    const err = loadManualFile(file);
    if (!err) {
      onAnnouncePolite(
        `Loaded audio file for ${prompt.pularText}. Preview or tap Save.`
      );
    }
  };

  const isRecording = recorderState === "recording";
  const isRequesting = recorderState === "requesting";
  const isProcessing = recorderState === "processing";
  const isBusy = isRequesting || isProcessing;
  const hasPreviewTake = recorderState === "preview" && take !== null;

  return (
    <div className="flex flex-col gap-3">
      {/* Mic or upload errors */}
      {(micError || uploadError) && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">
            {uploadError ?? micError}
          </AlertDescription>
        </Alert>
      )}

      {/* Idle, Requesting, or Processing state */}
      {!isRecording && !hasPreviewTake && (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button
            type="button"
            size="lg"
            disabled={isBusy}
            onClick={handleRecordClick}
            aria-label={`Record pronunciation for ${prompt.pularText}`}
            className="min-h-13 flex-1 gap-2 text-base font-semibold"
          >
            {isBusy ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <Mic className="size-5" aria-hidden="true" />
            )}
            <span>
              {isRequesting
                ? "Opening Microphone…"
                : isProcessing
                  ? "Preparing Preview…"
                  : existingClip?.public_url
                    ? "Record New Take"
                    : "Tap to Record"}
            </span>
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/wav,audio/mp4,audio/mpeg,audio/webm,audio/ogg,.wav,.mp3,.mp4,.m4a,.webm,.ogg"
            className="sr-only"
            onChange={handleFileChange}
            aria-label={`Upload audio file for ${prompt.pularText}`}
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            aria-label={`Upload file for ${prompt.pularText}`}
            className="min-h-13 gap-2 sm:w-auto"
          >
            <Upload className="size-4" aria-hidden="true" />
            <span>Upload File</span>
          </Button>
        </div>
      )}

      {/* Active Recording state */}
      {isRecording && (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-destructive/60 bg-destructive/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className="inline-block size-3 rounded-full bg-destructive animate-pulse"
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-destructive">
                Listening… Speak clearly
              </span>
            </div>
            {/* Visual timer only — omitted from aria-live to avoid screen-reader spam */}
            <span
              aria-hidden="true"
              className="font-mono text-sm font-medium tabular-nums text-foreground"
            >
              {formatTimer(elapsedMs)} / {formatTimer(MAX_RECORDING_MS)}
            </span>
          </div>

          {/* Live visual mic level bar */}
          <div
            aria-hidden="true"
            className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-destructive transition-[width] duration-75"
              style={{ width: `${Math.max(6, inputLevel)}%` }}
            />
          </div>

          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={handleStopClick}
            aria-label={`Stop recording for ${prompt.pularText}`}
            className="min-h-13 w-full gap-2 bg-destructive text-base font-semibold text-white hover:bg-destructive/90"
          >
            <Square className="size-4 fill-current" aria-hidden="true" />
            <span>Stop Recording</span>
          </Button>
        </div>
      )}

      {/* Preview & Save / One-tap Retry state */}
      {hasPreviewTake && take && (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                {take.source === "file"
                  ? `Selected file: ${take.fileName ?? "audio clip"}`
                  : "New take ready — listen before saving"}
              </span>
              <span className="text-xs text-muted-foreground">
                Format: .{take.fileExt} · {(take.blob.size / 1024).toFixed(0)} KB
                {take.source === "recorded" && take.durationMs > 0
                  ? ` · ${(take.durationMs / 1000).toFixed(1)}s`
                  : ""}
              </span>
            </div>

            <AudioPlayButton
              clipId={`preview-${prompt.clipKey}`}
              src={take.previewUrl}
              format={take.fileExt}
              accessibleSubject={`new recording of ${prompt.pularText}`}
              label="Preview"
              variant="outline"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="lg"
              disabled={isUploading}
              onClick={handleSaveRequest}
              aria-label={
                uploadError
                  ? `Retry upload for ${prompt.pularText}`
                  : `Save recording for ${prompt.pularText}`
              }
              className="min-h-13 flex-1 gap-2 text-base font-semibold"
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  <span>Uploading Clip…</span>
                </>
              ) : uploadError ? (
                <>
                  <RefreshCw className="size-5" aria-hidden="true" />
                  <span>Retry Upload</span>
                </>
              ) : (
                <>
                  <Check className="size-5" aria-hidden="true" />
                  <span>
                    {existingClip?.public_url
                      ? "Replace & Save Clip"
                      : "Save & Next"}
                  </span>
                </>
              )}
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isUploading}
                onClick={handleRecordClick}
                aria-label={`Re-record pronunciation for ${prompt.pularText}`}
                className="min-h-13 flex-1 gap-1.5 sm:flex-initial"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                <span>Re-record</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="lg"
                disabled={isUploading}
                onClick={() => {
                  stopPlayback();
                  discardTake();
                  clearUploadError();
                  onAnnouncePolite("Discarded unsaved take.");
                }}
                aria-label={`Discard take for ${prompt.pularText}`}
                className="min-h-13 gap-1.5 text-muted-foreground"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Discard</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation dialog when replacing an already-saved recording */}
      <AlertDialog
        open={confirmOverwriteOpen}
        onOpenChange={setConfirmOverwriteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing recording?</AlertDialogTitle>
            <AlertDialogDescription>
              A clip is already saved for{" "}
              <span lang="ff" className="font-semibold text-foreground">
                {prompt.pularText}
              </span>
              . Saving this new take will replace the previous draft for review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Existing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOverwriteOpen(false);
                void performUpload();
              }}
            >
              Replace Clip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
