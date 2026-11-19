"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioPlayButton } from "@/components/audio/audio-play-button";
import { useHowlerPlayer } from "@/hooks/use-howler-player";
import { buildCacheBustedAudioUrl } from "@/lib/audio/mime";
import type {
  AudioClipRow,
  CompetenceMeta,
  LearnerVocabularyItem,
} from "@/types/audio";

interface VocabularyBrowserProps {
  competences: CompetenceMeta[];
  vocabulary: LearnerVocabularyItem[];
  approvedClips: AudioClipRow[];
}

export function VocabularyBrowser({
  competences,
  vocabulary,
  approvedClips,
}: VocabularyBrowserProps) {
  useHowlerPlayer(true);

  const [selectedComp, setSelectedComp] = useState<string>("1");
  const [searchQuery, setSearchQuery] = useState("");

  const clipsByKey = useMemo(() => {
    const map = new Map<string, AudioClipRow>();
    for (const clip of approvedClips) {
      if (clip.status === "approved" && clip.public_url && clip.file_ext) {
        map.set(clip.clip_key, clip);
      }
    }
    return map;
  }, [approvedClips]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return vocabulary.filter((item) => {
      if (selectedComp !== "all" && String(item.competence) !== selectedComp) {
        return false;
      }
      if (!query) return true;
      return (
        item.pular.toLowerCase().includes(query) ||
        item.asciiSearchText.toLowerCase().includes(query) ||
        item.english.toLowerCase().includes(query) ||
        item.categoryLabel.toLowerCase().includes(query)
      );
    });
  }, [vocabulary, selectedComp, searchQuery]);

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, LearnerVocabularyItem[]>();
    for (const item of filteredItems) {
      const existing = groups.get(item.categoryLabel) ?? [];
      existing.push(item);
      groups.set(item.categoryLabel, existing);
    }
    return Array.from(groups.entries());
  }, [filteredItems]);

  const activeCompMeta = competences.find(
    (c) => String(c.number) === selectedComp
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <BookOpen className="size-4 text-primary" aria-hidden="true" />
            <span>Pular (Fuuta Jallon) · Competences 1–3</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <span lang="ff">Miɗo Waawi Pular!</span> Vocabulary
          </h1>
          <p className="text-sm text-muted-foreground">
            Listen to native-speaker recordings for core greetings,
            introductions, and family vocabulary.
          </p>
        </div>

        <nav aria-label="Primary" className="flex items-center gap-2">
          <Link
            href="/admin"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ShieldCheck className="size-4" aria-hidden="true" />
            <span>Admin</span>
          </Link>
        </nav>
      </header>

      {/* Competence tabs + Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={selectedComp}
          onValueChange={(val) => setSelectedComp(val ?? "1")}
        >
          <TabsList className="flex-wrap">
            {competences.map((comp) => (
              <TabsTrigger key={comp.number} value={String(comp.number)}>
                {comp.number}. {comp.title}
              </TabsTrigger>
            ))}
            <TabsTrigger value="all">All (45)</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <Label htmlFor="vocab-search" className="sr-only">
            Search Pular or English vocabulary
          </Label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="vocab-search"
            type="search"
            enterKeyHint="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Pular or English…"
            className="min-h-10 pl-9"
          />
        </div>
      </div>

      {activeCompMeta && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">
            Competence {activeCompMeta.number}: {activeCompMeta.title} —{" "}
            <span lang="ff" className="italic">
              {activeCompMeta.pularTitle}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            &ldquo;{activeCompMeta.englishSubtitle}&rdquo; ·{" "}
            {activeCompMeta.baseCount} vocabulary entries
          </p>
        </div>
      )}

      {/* Vocabulary Cards grouped by Category */}
      <main className="flex flex-1 flex-col gap-6">
        {groupedByCategory.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No vocabulary entries matched &ldquo;{searchQuery}&rdquo;.
            </CardContent>
          </Card>
        ) : (
          groupedByCategory.map(([categoryLabel, items]) => (
            <section key={categoryLabel} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {categoryLabel}
              </h2>
              <ul role="list" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map((item) => {
                  const baseClip = clipsByKey.get(item.baseClipKey);
                  const pluralClip = item.pluralClipKey
                    ? clipsByKey.get(item.pluralClipKey)
                    : undefined;

                  return (
                    <li key={item.vocabId}>
                      <Card className="h-full">
                        <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-col gap-0.5">
                                <h3
                                  lang="ff"
                                  className="text-lg font-bold text-foreground"
                                >
                                  {item.pular}
                                </h3>
                                <p className="text-sm font-medium text-foreground/85">
                                  {item.english}
                                </p>
                              </div>

                              {baseClip?.public_url && baseClip.file_ext ? (
                                <AudioPlayButton
                                  clipId={`learn-${item.baseClipKey}`}
                                  src={buildCacheBustedAudioUrl(
                                    baseClip.public_url,
                                    baseClip.updated_at
                                  )}
                                  format={baseClip.file_ext}
                                  accessibleSubject={item.pular}
                                  label="Listen"
                                  size="sm"
                                />
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 text-[11px] text-muted-foreground"
                                >
                                  Audio soon
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary" className="text-xs">
                                {item.registerLabel}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {item.partOfSpeechLabel}
                              </Badge>
                            </div>

                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {item.usageNote}
                            </p>
                          </div>

                          {/* Plural Form Row — plural play button renders conditionally when approved */}
                          {item.pluralForm && (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/35 px-3 py-2">
                              <div className="text-xs">
                                <span className="text-muted-foreground">
                                  Plural:{" "}
                                </span>
                                <span
                                  lang="ff"
                                  className="font-semibold text-foreground"
                                >
                                  {item.pluralForm}
                                </span>
                              </div>
                              {pluralClip?.public_url && pluralClip.file_ext && (
                                <AudioPlayButton
                                  clipId={`learn-plural-${item.vocabId}`}
                                  src={buildCacheBustedAudioUrl(
                                    pluralClip.public_url,
                                    pluralClip.updated_at
                                  )}
                                  format={pluralClip.file_ext}
                                  accessibleSubject={`plural form ${item.pluralForm}`}
                                  label="Plural"
                                  size="sm"
                                  variant="outline"
                                />
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
