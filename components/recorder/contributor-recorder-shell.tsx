"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flag,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AudioPlayButton } from "@/components/audio/audio-play-button";
import { AudioCaptureBar } from "@/components/recorder/audio-capture-bar";
import { BatchChecklistDrawer } from "@/components/recorder/batch-checklist-drawer";
import { DialectFlagDialog } from "@/components/recorder/dialect-flag-dialog";
import { WebViewWarningBanner } from "@/components/recorder/webview-warning-banner";
import { useHowlerPlayer } from "@/hooks/use-howler-player";
import { buildCacheBustedAudioUrl } from "@/lib/audio/mime";
import type {
  AudioClipRow,
  CompetenceMeta,
  CompetenceNumber,
  ContributorSessionInfo,
  RecordingPromptItem,
} from "@/types/audio";

interface ContributorRecorderShellProps {
  session: ContributorSessionInfo;
  competences: CompetenceMeta[];
  activeCompetence: CompetenceNumber | null;
  prompts: RecordingPromptItem[];
  initialClips: AudioClipRow[];
}

export function ContributorRecorderShell({
  session,
  competences,
  activeCompetence,
  prompts,
  initialClips,
}: ContributorRecorderShellProps) {
  const router = useRouter();
  // Ensure audio cleanly stops if Next.js 16 <Activity> hides this route
  useHowlerPlayer(true);

  const [clipsByKey, setClipsByKey] = useState<Record<string, AudioClipRow>>(
    () => {
      const map: Record<string, AudioClipRow> = {};
      for (const clip of initialClips) {
        map[clip.clip_key] = clip;
      }
      return map;
    }
  );

  // Start on the first unrecorded item in the current batch so speakers resume naturally
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    const firstPending = prompts.findIndex((p) => {
      const clip = initialClips.find((c) => c.clip_key === p.clipKey);
      return !clip || clip.status === "rejected" || !clip.public_url;
    });
    return firstPending >= 0 ? firstPending : 0;
  });

  const [checklistOpen, setChecklistOpen] = useState(false);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);

  // Centralized live regions (polite + assertive) — never updated on timer ticks
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");

  const announcePolite = useCallback((msg: string) => {
    setPoliteMessage("");
    window.setTimeout(() => setPoliteMessage(msg), 30);
  }, []);

  const announceAssertive = useCallback((msg: string) => {
    setAssertiveMessage("");
    window.setTimeout(() => setAssertiveMessage(msg), 30);
  }, []);

  const currentPrompt = prompts[currentIndex] ?? prompts[0];
  const currentClip = currentPrompt
    ? (clipsByKey[currentPrompt.clipKey] ?? null)
    : null;

  const { recordedCount, flaggedCount, progressPercent } = useMemo(() => {
    let recorded = 0;
    let flagged = 0;
    for (const item of prompts) {
      const clip = clipsByKey[item.clipKey];
      if (clip?.public_url && (clip.status === "draft" || clip.status === "approved")) {
        recorded++;
      } else if (clip?.status === "flagged") {
        flagged++;
      }
    }
    const percent =
      prompts.length > 0 ? Math.round((recorded / prompts.length) * 100) : 0;
    return { recordedCount: recorded, flaggedCount: flagged, progressPercent: percent };
  }, [prompts, clipsByKey]);

  const advanceToNext = useCallback(
    (updatedClips?: Record<string, AudioClipRow>) => {
      const lookup = updatedClips ?? clipsByKey;
      // Prefer moving to the next unrecorded item after currentIndex, else next index
      const nextUnrecorded = prompts.findIndex(
        (p, idx) =>
          idx > currentIndex &&
          (!lookup[p.clipKey]?.public_url ||
            lookup[p.clipKey]?.status === "rejected")
      );
      if (nextUnrecorded >= 0) {
        setCurrentIndex(nextUnrecorded);
        return;
      }
      if (currentIndex < prompts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    },
    [clipsByKey, currentIndex, prompts]
  );

  const handleClipSaved = useCallback(
    (savedClip: AudioClipRow) => {
      const updated = { ...clipsByKey, [savedClip.clip_key]: savedClip };
      setClipsByKey(updated);
      toast.success("Clip saved as draft");
      announcePolite(
        `Saved recording for ${currentPrompt.pularText}. Moving to next phrase.`
      );
      advanceToNext(updated);
    },
    [clipsByKey, currentPrompt, announcePolite, advanceToNext]
  );

  const handleClipFlagged = useCallback(
    (flaggedClip: AudioClipRow) => {
      const updated = { ...clipsByKey, [flaggedClip.clip_key]: flaggedClip };
      setClipsByKey(updated);
      toast.info("Dialect note saved");
      announcePolite(
        `Saved dialect note for ${currentPrompt.pularText}. Moving to next phrase.`
      );
      advanceToNext(updated);
    },
    [clipsByKey, currentPrompt, announcePolite, advanceToNext]
  );

  const handleSwitchBatch = (comp: CompetenceNumber | null) => {
    const target = comp ? `/contribute?competence=${comp}` : "/contribute";
    router.push(target);
  };

  if (!currentPrompt) {
    return null;
  }

  const allBatchRecorded = recordedCount === prompts.length && prompts.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5 sm:py-8">
      {/* Centralized accessible live regions */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {politeMessage}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {assertiveMessage}
      </div>

      {/* Top Header */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Miɗo Waawi Pular! · Native Speaker Studio
            </p>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              On jaraama, {session.speakerName}
            </h1>
            {session.dialectRegion && (
              <p className="text-xs text-muted-foreground">
                Dialect / Region: {session.dialectRegion}
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setChecklistOpen(true)}
            className="min-h-10 gap-2"
          >
            <ListChecks className="size-4" aria-hidden="true" />
            <span>
              List ({recordedCount}/{prompts.length})
            </span>
          </Button>
        </div>

        {/* Batch Selector */}
        <nav
          aria-label="Competence batches"
          className="flex flex-wrap items-center gap-1.5"
        >
          {competences.map((comp) => {
            const isActive = activeCompetence === comp.number;
            return (
              <Button
                key={comp.number}
                type="button"
                variant={isActive ? "default" : "outline"}
                size="sm"
                aria-current={isActive ? "page" : undefined}
                onClick={() => handleSwitchBatch(comp.number)}
                className="min-h-9"
              >
                {comp.number}. {comp.title} ({comp.totalClipCount})
              </Button>
            );
          })}
          <Button
            type="button"
            variant={activeCompetence === null ? "default" : "outline"}
            size="sm"
            aria-current={activeCompetence === null ? "page" : undefined}
            onClick={() => handleSwitchBatch(null)}
            className="min-h-9"
          >
            All (63)
          </Button>
        </nav>

        {/* Progress Bar */}
        <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-3.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-foreground">
              {recordedCount} of {prompts.length} recorded
              {flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ""}
            </span>
            <span className="text-muted-foreground">{progressPercent}%</span>
          </div>
          <Progress
            value={progressPercent}
            aria-label={`Batch recording progress: ${recordedCount} of ${prompts.length} phrases recorded`}
          />
        </div>
      </header>

      {/* In-app browser (WhatsApp/Instagram/etc.) warning banner */}
      <WebViewWarningBanner />

      {/* Completion banner when batch is finished */}
      {allBatchRecorded && (
        <Alert className="border-emerald-500/40 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">
          <Sparkles className="size-4" aria-hidden="true" />
          <AlertTitle className="font-semibold">
            Batch complete — A jaraama fota!
          </AlertTitle>
          <AlertDescription className="text-sm">
            Every phrase in this batch has a saved recording ready for review.
            You can replay any card or switch to another competence batch above.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Single-Card Mobile-First Recording Prompt */}
      <main className="flex flex-1 flex-col">
        <Card className="flex flex-col shadow-sm">
          <CardHeader className="flex flex-col gap-3 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">
                  Card {currentIndex + 1} of {prompts.length}
                </Badge>
                <Badge variant="outline">{currentPrompt.categoryLabel}</Badge>
                <Badge variant="outline">{currentPrompt.registerLabel}</Badge>
                {currentPrompt.isPlural && (
                  <Badge className="bg-indigo-600 text-white">
                    Plural Form
                  </Badge>
                )}
              </div>

              {/* Clip status pill */}
              <div>
                {currentClip?.status === "approved" && (
                  <Badge className="gap-1 bg-emerald-600 text-white">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    Approved
                  </Badge>
                )}
                {currentClip?.status === "draft" && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2
                      className="size-3.5 text-emerald-600"
                      aria-hidden="true"
                    />
                    Draft Saved
                  </Badge>
                )}
                {currentClip?.status === "flagged" && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-amber-500 text-amber-700 dark:text-amber-300"
                  >
                    <Flag className="size-3.5" aria-hidden="true" />
                    Flagged
                  </Badge>
                )}
                {currentClip?.status === "rejected" && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="size-3.5" aria-hidden="true" />
                    Needs Re-record
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            {/* Hero Pular Reading Prompt */}
            <div className="rounded-xl bg-muted/50 px-4 py-6 text-center sm:px-6">
              {currentPrompt.isPlural && currentPrompt.singularReference && (
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Singular form:{" "}
                  <span lang="ff" className="font-semibold text-foreground">
                    {currentPrompt.singularReference}
                  </span>
                </p>
              )}
              <p
                lang="ff"
                className="text-3xl font-bold leading-snug tracking-tight text-foreground sm:text-4xl"
              >
                {currentPrompt.pularText}
              </p>
              <p className="mt-3 text-lg font-semibold text-foreground/90 sm:text-xl">
                {currentPrompt.englishText}
              </p>
            </div>

            {/* Strong visual weight for Usage & Tone Note */}
            <div className="rounded-xl border border-border bg-secondary/40 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Context & Tone Guide
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                {currentPrompt.usageNote}
              </p>
              {currentPrompt.pluralReference && !currentPrompt.isPlural && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Plural form (recorded separately):{" "}
                  <span lang="ff" className="font-semibold text-foreground">
                    {currentPrompt.pluralReference}
                  </span>
                </p>
              )}
            </div>

            {/* Reviewer feedback or saved dialect note */}
            {currentClip?.status === "rejected" && currentClip.review_note && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" aria-hidden="true" />
                <AlertTitle>Reviewer requested a retake</AlertTitle>
                <AlertDescription>{currentClip.review_note}</AlertDescription>
              </Alert>
            )}

            {currentClip?.dialect_note && (
              <Alert>
                <Flag className="size-4" aria-hidden="true" />
                <AlertTitle>Your dialect note</AlertTitle>
                <AlertDescription>{currentClip.dialect_note}</AlertDescription>
              </Alert>
            )}

            {/* Saved clip playback bar */}
            {currentClip?.public_url && currentClip.file_ext && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-3.5">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    Current saved recording
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {currentClip.status === "approved"
                      ? "Approved & live for learners"
                      : "Saved as draft for review"}
                    {currentClip.duration_ms
                      ? ` · ${(currentClip.duration_ms / 1000).toFixed(1)}s`
                      : ""}
                  </span>
                </div>
                <AudioPlayButton
                  clipId={`saved-${currentPrompt.clipKey}`}
                  src={buildCacheBustedAudioUrl(
                    currentClip.public_url,
                    currentClip.updated_at
                  )}
                  format={currentClip.file_ext}
                  accessibleSubject={`saved recording of ${currentPrompt.pularText}`}
                  label="Listen"
                />
              </div>
            )}

            <Separator />

            {/* Record / Preview / Save / Retry / File Upload */}
            <AudioCaptureBar
              prompt={currentPrompt}
              existingClip={currentClip}
              onSaved={handleClipSaved}
              onAnnouncePolite={announcePolite}
              onAnnounceAssertive={announceAssertive}
            />
          </CardContent>

          <CardFooter className="flex items-center justify-between gap-2 border-t bg-muted/20 px-4 py-3 sm:px-6">
            <Button
              type="button"
              variant="outline"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="min-h-11 gap-1"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              <span>Previous</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setFlagDialogOpen(true)}
              aria-label={`Skip or flag dialect note for ${currentPrompt.pularText}`}
              className="min-h-11 gap-1.5 text-amber-700 hover:text-amber-800 dark:text-amber-300"
            >
              <Flag className="size-4" aria-hidden="true" />
              <span>Skip / Flag</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={currentIndex >= prompts.length - 1}
              onClick={() =>
                setCurrentIndex((i) => Math.min(prompts.length - 1, i + 1))
              }
              className="min-h-11 gap-1"
            >
              <span>Next</span>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </CardFooter>
        </Card>
      </main>

      <footer className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
        <span>Competences 1–3 · Pular (Fuuta Jallon)</span>
        <Link
          href="/"
          className={buttonVariants({ variant: "link", size: "xs" })}
        >
          Learner Library
        </Link>
      </footer>

      {/* Jump-list Drawer */}
      <BatchChecklistDrawer
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        prompts={prompts}
        clipsByKey={clipsByKey}
        currentIndex={currentIndex}
        onSelectIndex={setCurrentIndex}
      />

      {/* Skip / Flag Dialect Note Dialog */}
      <DialectFlagDialog
        key={currentPrompt.clipKey}
        open={flagDialogOpen}
        onOpenChange={setFlagDialogOpen}
        prompt={currentPrompt}
        existingNote={currentClip?.dialect_note ?? null}
        onFlagged={handleClipFlagged}
        onSkipOnly={() => {
          announcePolite(`Skipped ${currentPrompt.pularText}`);
          if (currentIndex < prompts.length - 1) {
            setCurrentIndex(currentIndex + 1);
          }
        }}
      />
    </div>
  );
}
