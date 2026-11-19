"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { audioPlayerManager, type PlaybackSnapshot } from "@/lib/audio/player";
import type { AllowedFileExt } from "@/types/audio";

const SERVER_SNAPSHOT: PlaybackSnapshot = {
  activeId: null,
  status: "idle",
  errorMessage: null,
};

export function useHowlerPlayer(stopOnUnmount = false) {
  const snapshot = useSyncExternalStore(
    audioPlayerManager.subscribe,
    audioPlayerManager.getSnapshot,
    () => SERVER_SNAPSHOT
  );

  useEffect(() => {
    if (!stopOnUnmount) return;
    return () => {
      audioPlayerManager.stop();
    };
  }, [stopOnUnmount]);

  const play = useCallback(
    (id: string, src: string, format: AllowedFileExt) => {
      audioPlayerManager.play({ id, src, format });
    },
    []
  );

  const stop = useCallback(() => {
    audioPlayerManager.stop();
  }, []);

  return {
    activeId: snapshot.activeId,
    status: snapshot.status,
    errorMessage: snapshot.errorMessage,
    play,
    stop,
  };
}
