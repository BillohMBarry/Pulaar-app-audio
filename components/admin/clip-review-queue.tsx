"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Flag,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AudioPlayButton } from "@/components/audio/audio-play-button";
import { buildCacheBustedAudioUrl } from "@/lib/audio/mime";
import type {
  AudioClipRow,
  ClipStatus,
  RecordingPromptItem,
} from "@/types/audio";

interface ClipReviewQueueProps {
  prompts: RecordingPromptItem[];
  clips: AudioClipRow[];
  onClipUpdated: (clip: AudioClipRow) => void;
  onClipDeleted: (clipKey: string) => void;
}

type StatusFilter = "pending" | ClipStatus | "all";

export function ClipReviewQueue({
  prompts,
  clips,
  onClipUpdated,
  onClipDeleted,
}: ClipReviewQueueProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [compFilter, setCompFilter] = useState<string>("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notesByKey, setNotesByKey] = useState<Record<string, string>>({});
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  const promptByKey = useMemo(() => {
    const map = new Map<string, RecordingPromptItem>();
    for (const p of prompts) {
      map.set(p.clipKey, p);
    }
    return map;
  }, [prompts]);

  const filteredClips = useMemo(() => {
    return clips
      .filter((clip) => {
        if (compFilter !== "all" && String(clip.competence) !== compFilter) {
          return false;
        }
        if (statusFilter === "pending") {
          return clip.status === "draft" || clip.status === "flagged";
        }
        if (statusFilter === "all") return true;
        return clip.status === statusFilter;
      })
      .sort(
        (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
      );
  }, [clips, statusFilter, compFilter]);

  const handleReview = async (clipKey: string, nextStatus: ClipStatus) => {
    setBusyKey(clipKey);
    try {
      const res = await fetch("/api/admin/clips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipKey,
          status: nextStatus,
          reviewNote: notesByKey[clipKey]?.trim() || null,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        clip?: AudioClipRow;
        error?: string;
      };
      if (!res.ok || !payload.clip) {
        toast.error(payload.error ?? "Failed to update clip.");
        return;
      }
      onClipUpdated(payload.clip);
      toast.success(
        nextStatus === "approved"
          ? "Clip approved and published for learners"
          : "Clip marked for re-recording"
      );
    } catch {
      toast.error("Network error while updating clip.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteKey) return;
    const keyToDelete = confirmDeleteKey;
    setConfirmDeleteKey(null);
    setBusyKey(keyToDelete);
    try {
      const res = await fetch(
        `/api/admin/clips?clipKey=${encodeURIComponent(keyToDelete)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("Could not delete clip.");
        return;
      }
      onClipDeleted(keyToDelete);
      toast.success("Clip deleted");
    } catch {
      toast.error("Network error while deleting clip.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filter clips by status"
        >
          {(
            [
              { value: "pending", label: "Needs Review" },
              { value: "draft", label: "Drafts" },
              { value: "flagged", label: "Flagged" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "all", label: "All" },
            ] as Array<{ value: StatusFilter; label: string }>
          ).map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={statusFilter === item.value ? "default" : "outline"}
              onClick={() => setStatusFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filter clips by competence"
        >
          {["all", "1", "2", "3"].map((comp) => (
            <Button
              key={comp}
              type="button"
              size="sm"
              variant={compFilter === comp ? "secondary" : "ghost"}
              onClick={() => setCompFilter(comp)}
            >
              {comp === "all" ? "All Comp." : `Comp ${comp}`}
            </Button>
          ))}
        </div>
      </div>

      {/* Review List */}
      {filteredClips.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No audio clips match the selected filters.
          </CardContent>
        </Card>
      ) : (
        <ul role="list" className="flex flex-col gap-3">
          {filteredClips.map((clip) => {
            const prompt = promptByKey.get(clip.clip_key);
            const pularLabel = prompt?.pularText ?? clip.clip_key;
            const isBusy = busyKey === clip.clip_key;
            const noteValue =
              notesByKey[clip.clip_key] ?? clip.review_note ?? "";

            return (
              <li key={clip.clip_key}>
                <Card>
                  <CardContent className="flex flex-col gap-4 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline">
                            Competence {clip.competence}
                          </Badge>
                          {clip.is_plural && (
                            <Badge className="bg-indigo-600 text-white">
                              Plural Form
                            </Badge>
                          )}
                          {clip.status === "approved" && (
                            <Badge className="bg-emerald-600 text-white">
                              Approved
                            </Badge>
                          )}
                          {clip.status === "draft" && (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                          {clip.status === "flagged" && (
                            <Badge
                              variant="outline"
                              className="border-amber-500 text-amber-700 dark:text-amber-300"
                            >
                              Flagged
                            </Badge>
                          )}
                          {clip.status === "rejected" && (
                            <Badge variant="destructive">Rejected</Badge>
                          )}
                        </div>

                        <p lang="ff" className="text-xl font-bold text-foreground">
                          {pularLabel}
                        </p>
                        {prompt && (
                          <p className="text-sm text-muted-foreground">
                            {prompt.englishText} · {prompt.registerLabel}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Speaker: {clip.speaker_name ?? "Unknown"}
                          {clip.file_ext ? ` · .${clip.file_ext}` : ""}
                          {clip.duration_ms
                            ? ` · ${(clip.duration_ms / 1000).toFixed(1)}s`
                            : ""}
                        </p>
                      </div>

                      {clip.public_url && clip.file_ext ? (
                        <AudioPlayButton
                          clipId={`admin-${clip.clip_key}`}
                          src={buildCacheBustedAudioUrl(
                            clip.public_url,
                            clip.updated_at
                          )}
                          format={clip.file_ext}
                          accessibleSubject={pularLabel}
                          label="Play Clip"
                        />
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          No audio yet
                        </Badge>
                      )}
                    </div>

                    {clip.dialect_note && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                        <Flag
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <div>
                          <span className="font-semibold">Speaker note: </span>
                          {clip.dialect_note}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
                      <div className="flex flex-1 flex-col gap-1">
                        <Label
                          htmlFor={`review-note-${clip.clip_key}`}
                          className="text-xs text-muted-foreground"
                        >
                          Reviewer note (optional — shown to speaker if rejected)
                        </Label>
                        <Input
                          id={`review-note-${clip.clip_key}`}
                          value={noteValue}
                          onChange={(e) =>
                            setNotesByKey((prev) => ({
                              ...prev,
                              [clip.clip_key]: e.target.value,
                            }))
                          }
                          placeholder="e.g. Slight background noise, please re-record closer to mic"
                          className="min-h-9"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {clip.public_url && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isBusy || clip.status === "approved"}
                            onClick={() =>
                              handleReview(clip.clip_key, "approved")
                            }
                            aria-label={`Approve audio for ${pularLabel}`}
                            className="min-h-9 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            {isBusy ? (
                              <Loader2
                                className="size-3.5 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <CheckCircle2
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            )}
                            <span>Approve</span>
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() =>
                            handleReview(clip.clip_key, "rejected")
                          }
                          aria-label={`Request retake for ${pularLabel}`}
                          className="min-h-9 gap-1.5"
                        >
                          <XCircle className="size-3.5" aria-hidden="true" />
                          <span>Request Retake</span>
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => setConfirmDeleteKey(clip.clip_key)}
                          aria-label={`Delete clip for ${pularLabel}`}
                          className="min-h-9 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={Boolean(confirmDeleteKey)}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteKey(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete audio clip permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the recording from Supabase Storage and deletes the
              review record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Delete Clip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
