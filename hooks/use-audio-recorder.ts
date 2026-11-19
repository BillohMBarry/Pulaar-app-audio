"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_AUDIO_FILE_SIZE_BYTES,
  normalizeMimeType,
  pickRecordingMimeChoice,
} from "@/lib/audio/mime";
import type { AllowedFileExt, AllowedMimeType } from "@/types/audio";

export const MAX_RECORDING_MS = 20_000;

export interface CapturedTake {
  blob: Blob;
  previewUrl: string;
  mimeType: AllowedMimeType;
  fileExt: AllowedFileExt;
  durationMs: number;
  source: "recorded" | "file";
  fileName?: string;
}

export type RecorderState = "idle" | "requesting" | "recording" | "preview";

function describeMicError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "Microphone access was blocked. Allow microphone permission in your browser settings and try again.";
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      return "No microphone was found on this device. Connect a mic or upload a pre-recorded audio file.";
    }
    if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      return "Your microphone is currently busy in another app. Close other voice/call apps and try again.";
    }
  }
  return "Could not start microphone recording. Try opening this link in Chrome or Safari, or upload an audio file.";
}

export function useAudioRecorder() {
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [take, setTake] = useState<CapturedTake | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [inputLevel, setInputLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const previewUrlRef = useRef<string | null>(null);

  const releaseCaptureHardware = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (timerIdRef.current !== null) {
      window.clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    mediaRecorderRef.current = null;
    setInputLevel(0);
  }, []);

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  // Full cleanup on unmount or Next.js 16 <Activity> route hiding
  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      releaseCaptureHardware();
      revokePreviewUrl();
    };
  }, [releaseCaptureHardware, revokePreviewUrl]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        releaseCaptureHardware();
        setRecorderState("idle");
      }
    }
  }, [releaseCaptureHardware]);

  const startRecording = useCallback(async () => {
    setMicError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setMicError(
        "Direct microphone recording is unavailable in this browser. Open in Chrome or Safari, or upload an audio file."
      );
      return;
    }

    // Clear any prior unsaved preview before starting fresh
    revokePreviewUrl();
    setTake(null);
    setElapsedMs(0);
    setRecorderState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      const mimeChoice = pickRecordingMimeChoice();
      const recorder = MediaRecorder.isTypeSupported(
        mimeChoice.recorderMimeType
      )
        ? new MediaRecorder(stream, { mimeType: mimeChoice.recorderMimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mediaRecorderRef.current = recorder;

      // Setup live microphone level meter via Web Audio API AnalyserNode
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const sampleLevel = () => {
            analyser.getByteTimeDomainData(dataArray);
            let sumSquares = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const normalized = (dataArray[i] - 128) / 128;
              sumSquares += normalized * normalized;
            }
            const rms = Math.sqrt(sumSquares / dataArray.length);
            const scaled = Math.min(100, Math.round(rms * 280));
            setInputLevel(scaled);
            rafIdRef.current = requestAnimationFrame(sampleLevel);
          };
          rafIdRef.current = requestAnimationFrame(sampleLevel);
        }
      } catch {
        // Non-fatal: continue recording even if AnalyserNode fails
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const durationMs = Math.max(
          250,
          Math.round(Date.now() - startTimeRef.current)
        );
        const actualMime = recorder.mimeType || mimeChoice.recorderMimeType;
        const normalized = normalizeMimeType(actualMime) ?? {
          mimeType: mimeChoice.canonicalMimeType,
          fileExt: mimeChoice.fileExt,
        };

        const blob = new Blob(chunksRef.current, {
          type: normalized.mimeType,
        });
        chunksRef.current = [];
        releaseCaptureHardware();

        if (blob.size === 0) {
          setMicError(
            "No audio was captured. Please check your microphone and try again."
          );
          setRecorderState("idle");
          return;
        }

        const previewUrl = URL.createObjectURL(blob);
        previewUrlRef.current = previewUrl;

        setTake({
          blob,
          previewUrl,
          mimeType: normalized.mimeType,
          fileExt: normalized.fileExt,
          durationMs,
          source: "recorded",
        });
        setElapsedMs(durationMs);
        setRecorderState("preview");
      };

      recorder.onerror = () => {
        releaseCaptureHardware();
        setRecorderState("idle");
        setMicError("Recording was interrupted. Please try recording again.");
      };

      startTimeRef.current = Date.now();
      recorder.start(250);
      setRecorderState("recording");

      timerIdRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedMs(elapsed);
        if (elapsed >= MAX_RECORDING_MS) {
          stopRecording();
        }
      }, 100);
    } catch (err) {
      releaseCaptureHardware();
      setRecorderState("idle");
      setMicError(describeMicError(err));
    }
  }, [releaseCaptureHardware, revokePreviewUrl, stopRecording]);

  const loadManualFile = useCallback(
    (file: File): string | null => {
      setMicError(null);

      if (file.size <= 0 || file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
        const message = "Audio file must be smaller than 5 MB.";
        setMicError(message);
        return message;
      }

      const normalized = normalizeMimeType(file.type, file.name);
      if (!normalized) {
        const message =
          "Unsupported file format. Please choose an .mp4, .m4a, .webm, .mp3, or .ogg audio clip.";
        setMicError(message);
        return message;
      }

      revokePreviewUrl();
      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;

      setTake({
        blob: file,
        previewUrl,
        mimeType: normalized.mimeType,
        fileExt: normalized.fileExt,
        durationMs: 1000,
        source: "file",
        fileName: file.name,
      });
      setElapsedMs(0);
      setRecorderState("preview");
      return null;
    },
    [revokePreviewUrl]
  );

  const discardTake = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      stopRecording();
    }
    releaseCaptureHardware();
    revokePreviewUrl();
    setTake(null);
    setElapsedMs(0);
    setMicError(null);
    setRecorderState("idle");
  }, [releaseCaptureHardware, revokePreviewUrl, stopRecording]);

  return {
    recorderState,
    take,
    elapsedMs,
    inputLevel,
    micError,
    startRecording,
    stopRecording,
    loadManualFile,
    discardTake,
  };
}
