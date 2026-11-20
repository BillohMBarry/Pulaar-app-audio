import { Suspense } from "react";
import { connection } from "next/server";
import { Skeleton } from "@/components/ui/skeleton";
import { VocabularyBrowser } from "@/components/learner/vocabulary-browser";
import { getCompetences, getLearnerVocabulary } from "@/lib/curriculum";
import { createClient } from "@/lib/server";
import type { AudioClipRow } from "@/types/audio";

async function LearnerVocabularyContent() {
  // Opt into request-time rendering cleanly inside <Suspense> before calling
  // Supabase SSR (which uses cookies() and internal Date.now() checks).
  await connection();

  const competences = getCompetences();
  const vocabulary = getLearnerVocabulary();
  const supabase = await createClient();

  let approvedClips: AudioClipRow[] = [];
  try {
    const { data, error } = await supabase
      .from("audio_clips")
      .select("*")
      .eq("status", "approved");
    if (!error) {
      approvedClips = (data as AudioClipRow[] | null) ?? [];
    }
  } catch {
    // Gracefully render vocabulary list if the network request fails
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
