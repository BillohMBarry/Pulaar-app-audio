"use client";

import { useState } from "react";
import { Flag, Loader2, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AudioClipRow, RecordingPromptItem } from "@/types/audio";

interface DialectFlagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: RecordingPromptItem;
  existingNote: string | null;
  onFlagged: (clip: AudioClipRow) => void;
  onSkipOnly: () => void;
}

const QUICK_REASONS = [
  "Different phrasing used in my region",
  "Spelling or tone needs review",
  "Unclear whether singular or respectful form",
];

export function DialectFlagDialog({
  open,
  onOpenChange,
  prompt,
  existingNote,
  onFlagged,
  onSkipOnly,
}: DialectFlagDialogProps) {
  const [note, setNote] = useState(existingNote ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) {
      setError("Please add a short note, or choose Skip Without Flagging.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/contribute/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipKey: prompt.clipKey,
          dialectNote: trimmed,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        clip?: AudioClipRow;
        error?: string;
      };
      if (!res.ok || !payload.clip) {
        setError(payload.error ?? "Could not save your note. Please try again.");
        return;
      }
      onFlagged(payload.clip);
      onOpenChange(false);
    } catch {
      setError("Network error while saving note. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skip or Flag Dialect Note</DialogTitle>
          <DialogDescription>
            Leave a quick note for{" "}
            <span lang="ff" className="font-semibold text-foreground">
              {prompt.pularText}
            </span>{" "}
            if your Fuuta Jallon dialect says this differently or if anything looks
            unclear.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmitFlag} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_REASONS.map((reason) => (
              <Button
                key={reason}
                type="button"
                variant="outline"
                size="xs"
                onClick={() =>
                  setNote((prev) =>
                    prev.trim() ? `${prev.trim()} — ${reason}` : reason
                  )
                }
              >
                {reason}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="dialect-note-input">Dialect or pronunciation note</Label>
            <Textarea
              id="dialect-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Example: In Labé we usually say..."
              rows={3}
              maxLength={500}
              aria-describedby={error ? "dialect-note-error" : undefined}
              aria-invalid={Boolean(error)}
            />
            {error && (
              <p
                id="dialect-note-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                onSkipOnly();
              }}
              className="min-h-10 gap-1.5"
            >
              <SkipForward className="size-4" aria-hidden="true" />
              Skip Without Flagging
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="min-h-10 gap-1.5"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Flag className="size-4" aria-hidden="true" />
              )}
              Save Note & Next
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
