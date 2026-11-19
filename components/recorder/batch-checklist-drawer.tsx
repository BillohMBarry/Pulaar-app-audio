"use client";

import { CheckCircle2, Circle, Flag, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AudioClipRow, RecordingPromptItem } from "@/types/audio";
import { cn } from "@/lib/utils";

interface BatchChecklistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompts: RecordingPromptItem[];
  clipsByKey: Record<string, AudioClipRow>;
  currentIndex: number;
  onSelectIndex: (index: number) => void;
}

export function BatchChecklistDrawer({
  open,
  onOpenChange,
  prompts,
  clipsByKey,
  currentIndex,
  onSelectIndex,
}: BatchChecklistDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[82vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vocabulary Reading List</DialogTitle>
          <DialogDescription>
            Tap any phrase to jump directly to it. Recorded phrases stay saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          <ul role="list" className="flex flex-col gap-1.5">
            {prompts.map((item, idx) => {
              const clip = clipsByKey[item.clipKey];
              const isCurrent = idx === currentIndex;
              const status = clip?.status ?? null;

              return (
                <li key={item.clipKey}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectIndex(idx);
                      onOpenChange(false);
                    }}
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isCurrent
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/60"
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 shrink-0" aria-hidden="true">
                        {status === "approved" || status === "draft" ? (
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        ) : status === "flagged" ? (
                          <Flag className="size-4 text-amber-600" />
                        ) : status === "rejected" ? (
                          <AlertCircle className="size-4 text-destructive" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground/50" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            lang="ff"
                            className="truncate font-semibold text-foreground"
                          >
                            {item.pularText}
                          </span>
                          {item.isPlural && (
                            <Badge variant="outline" className="text-[11px]">
                              Plural
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.englishText}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {status === "approved" && (
                        <Badge className="bg-emerald-600 text-white">
                          Approved
                        </Badge>
                      )}
                      {status === "draft" && (
                        <Badge variant="secondary">Saved</Badge>
                      )}
                      {status === "flagged" && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/60 text-amber-700 dark:text-amber-300"
                        >
                          Flagged
                        </Badge>
                      )}
                      {status === "rejected" && (
                        <Badge variant="destructive">Re-record</Badge>
                      )}
                      {!status && (
                        <span className="text-xs text-muted-foreground">
                          #{idx + 1}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
