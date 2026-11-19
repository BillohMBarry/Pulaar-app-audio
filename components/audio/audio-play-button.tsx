"use client";

import { Loader2, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHowlerPlayer } from "@/hooks/use-howler-player";
import type { AllowedFileExt } from "@/types/audio";
import { cn } from "@/lib/utils";

interface AudioPlayButtonProps {
  clipId: string;
  src: string;
  format: AllowedFileExt;
  accessibleSubject: string;
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
}

/**
 * Reusable Howler.js playback button with:
 * - Single-active-clip coordination
 * - Explicit format + automatic html5: true retry on mobile onloaderror
 * - Disambiguated accessible name including visible text (WCAG 2.5.3 / 4.1.2)
 */
export function AudioPlayButton({
  clipId,
  src,
  format,
  accessibleSubject,
  label = "Listen",
  size = "default",
  variant = "secondary",
  className,
}: AudioPlayButtonProps) {
  const { activeId, status, errorMessage, play } = useHowlerPlayer();

  const isThisClip = activeId === clipId;
  const isLoading = isThisClip && status === "loading";
  const isPlaying = isThisClip && status === "playing";
  const hasError = isThisClip && status === "error";

  const visibleText = isPlaying ? "Stop" : isLoading ? "Loading" : label;
  const ariaLabel = isPlaying
    ? `Stop audio for ${accessibleSubject}`
    : `${label} audio for ${accessibleSubject}`;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={isPlaying ? "default" : variant}
        size={size}
        aria-label={ariaLabel}
        aria-pressed={isPlaying}
        onClick={() => play(clipId, src, format)}
        className={cn("min-h-10 min-w-10 gap-2", className)}
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : isPlaying ? (
          <Square className="size-3.5 fill-current" aria-hidden="true" />
        ) : (
          <Volume2 className="size-4" aria-hidden="true" />
        )}
        <span>{visibleText}</span>
      </Button>
      {hasError && errorMessage && (
        <span className="text-xs text-destructive" role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
