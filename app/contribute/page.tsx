import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Skeleton } from "@/components/ui/skeleton";
import { ContributorRecorderShell } from "@/components/recorder/contributor-recorder-shell";
import { InviteSessionGate } from "@/components/recorder/invite-session-gate";
import { getVerifiedContributorSession } from "@/lib/auth/contributor-session";
import {
  getCompetences,
  getRecordingPrompts,
  parseCompetenceParam,
} from "@/lib/curriculum";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AudioClipRow, CompetenceNumber } from "@/types/audio";

export const metadata: Metadata = {
  title: "Contributor Recorder",
  description:
    "Record native Pular (Fuuta Jallon) vocabulary pronunciations for Competences 1–3.",
};

interface ContributePageProps {
  searchParams: Promise<{
    token?: string | string[];
    competence?: string | string[];
  }>;
}

async function ContributeContent({ searchParams }: ContributePageProps) {
  await connection();

  const params = await searchParams;
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const rawCompetence = Array.isArray(params.competence)
    ? params.competence[0]
    : params.competence;

  // Always let the client POST-exchange a fresh ?token=... so WhatsApp link
  // preview GET bots never mutate session state.
  if (rawToken && rawToken.trim().length > 0) {
    return (
      <InviteSessionGate
        tokenFromUrl={rawToken.trim()}
        competenceParam={rawCompetence ?? null}
      />
    );
  }

  const session = await getVerifiedContributorSession();
  if (!session) {
    return (
      <InviteSessionGate
        tokenFromUrl={null}
        competenceParam={rawCompetence ?? null}
      />
    );
  }

  const requestedCompetence = parseCompetenceParam(rawCompetence);
  const activeCompetence: CompetenceNumber | null =
    requestedCompetence ??
    (rawCompetence === undefined ? session.defaultCompetence : null);

  const competences = getCompetences();
  const prompts = getRecordingPrompts(activeCompetence ?? undefined);

  const supabase = createAdminClient();
  let query = supabase.from("audio_clips").select("*");
  if (activeCompetence) {
    query = query.eq("competence", activeCompetence);
  }
  const { data: clips } = await query;

  return (
    <ContributorRecorderShell
      key={activeCompetence ?? "all"}
      session={session}
      competences={competences}
      activeCompetence={activeCompetence}
      prompts={prompts}
      initialClips={(clips as AudioClipRow[] | null) ?? []}
    />
  );
}

function ContributeFallback() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-[420px] w-full rounded-xl" />
    </div>
  );
}

export default function ContributePage({ searchParams }: ContributePageProps) {
  return (
    <Suspense fallback={<ContributeFallback />}>
      <ContributeContent searchParams={searchParams} />
    </Suspense>
  );
}
