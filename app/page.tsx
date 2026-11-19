import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { VocabularyBrowser } from "@/components/learner/vocabulary-browser";
import { getCompetences, getLearnerVocabulary } from "@/lib/curriculum";
import { createClient } from "@/lib/server";
import type { AudioClipRow } from "@/types/audio";

async function LearnerVocabularyContent() {
  const competences = getCompetences();
  const vocabulary = getLearnerVocabulary();

  let approvedClips: AudioClipRow[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("audio_clips")
      .select("*")
      .eq("status", "approved");
    approvedClips = (data as AudioClipRow[] | null) ?? [];
  } catch {
    // Gracefully render vocabulary list even before Supabase migration is run
    approvedClips = [];
  }

  return (
    <VocabularyBrowser
      competences={competences}
      vocabulary={vocabulary}
      approvedClips={approvedClips}
    />
  );
}

function HomeFallback() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <Skeleton className="h-14 w-72" />
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <LearnerVocabularyContent />
    </Suspense>
  );
}
