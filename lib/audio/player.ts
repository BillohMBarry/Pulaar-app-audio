"use client";

import { Howl } from "howler";
import type { AllowedFileExt } from "@/types/audio";

export type PlaybackStatus = "idle" | "loading" | "playing" | "error";

export interface PlaybackSnapshot {
  activeId: string | null;
  status: PlaybackStatus;
  errorMessage: string | null;
}

type Listener = (snapshot: PlaybackSnapshot) => void;

class SingleAudioManager {
  private currentHowl: Howl | null = null;
  private snapshot: PlaybackSnapshot = {
    activeId: null,
    status: "idle",
    errorMessage: null,
  };
  private listeners = new Set<Listener>();

  getSnapshot = (): PlaybackSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit(next: PlaybackSnapshot) {
    this.snapshot = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }

  stop() {
    if (this.currentHowl) {
      try {
        this.currentHowl.stop();
        this.currentHowl.unload();
      } catch {
        // Ignore Howler cleanup errors on already-unloaded instances
      }
      this.currentHowl = null;
    }

    if (this.snapshot.activeId !== null || this.snapshot.status !== "idle") {
      this.emit({ activeId: null, status: "idle", errorMessage: null });
    }
  }

  play(params: { id: string; src: string; format: AllowedFileExt }) {
    const { id, src, format } = params;

    // Toggle off if tapping the currently playing/loading clip
    if (
      this.snapshot.activeId === id &&
      (this.snapshot.status === "playing" || this.snapshot.status === "loading")
    ) {
      this.stop();
      return;
    }

    this.stop();
    this.startHowl({ id, src, format, useHtml5Fallback: false });
  }

  private startHowl(params: {
    id: string;
    src: string;
    format: AllowedFileExt;
    useHtml5Fallback: boolean;
  }) {
    const { id, src, format, useHtml5Fallback } = params;

    this.emit({ activeId: id, status: "loading", errorMessage: null });

    const howl = new Howl({
      src: [src],
      format: [format],
      html5: useHtml5Fallback,
      preload: true,
      onplay: () => {
        if (this.currentHowl !== howl) return;
        this.emit({ activeId: id, status: "playing", errorMessage: null });
      },
      onend: () => {
        if (this.currentHowl !== howl) return;
        howl.unload();
        this.currentHowl = null;
        this.emit({ activeId: null, status: "idle", errorMessage: null });
      },
      onstop: () => {
        if (this.currentHowl !== howl) return;
        this.emit({ activeId: null, status: "idle", errorMessage: null });
      },
      onloaderror: () => {
        if (this.currentHowl !== howl) return;
        howl.unload();
        this.currentHowl = null;

        // Automatic single retry using HTML5 Audio when Web Audio decode fails on mobile
        if (!useHtml5Fallback) {
          this.startHowl({ id, src, format, useHtml5Fallback: true });
          return;
        }

        this.emit({
          activeId: id,
          status: "error",
          errorMessage: "Could not load this audio clip. Please try again.",
        });
      },
      onplayerror: () => {
        if (this.currentHowl !== howl) return;
        if (!useHtml5Fallback) {
          howl.unload();
          this.currentHowl = null;
          this.startHowl({ id, src, format, useHtml5Fallback: true });
          return;
        }

        howl.once("unlock", () => {
          if (this.currentHowl === howl) {
            howl.play();
          }
        });
        this.emit({
          activeId: id,
          status: "error",
          errorMessage: "Tap again to unlock audio playback on this device.",
        });
      },
    });

    this.currentHowl = howl;
    howl.play();
  }
}

export const audioPlayerManager = new SingleAudioManager();
