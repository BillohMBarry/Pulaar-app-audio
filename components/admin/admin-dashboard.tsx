"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipReviewQueue } from "@/components/admin/clip-review-queue";
import { InviteManager } from "@/components/admin/invite-manager";
import { useHowlerPlayer } from "@/hooks/use-howler-player";
import { createClient } from "@/lib/client";
import type {
  AudioClipRow,
  CompetenceMeta,
  ContributorInviteRow,
  RecordingPromptItem,
} from "@/types/audio";

interface AdminDashboardProps {
  adminEmail: string | null;
  competences: CompetenceMeta[];
  prompts: RecordingPromptItem[];
  initialClips: AudioClipRow[];
  initialInvites: ContributorInviteRow[];
  serverNowMs: number;
}

export function AdminDashboard({
  adminEmail,
  competences,
  prompts,
  initialClips,
  initialInvites,
  serverNowMs,
}: AdminDashboardProps) {
  const router = useRouter();
  useHowlerPlayer(true);

  const [clips, setClips] = useState<AudioClipRow[]>(initialClips);
  const [invites, setInvites] = useState<ContributorInviteRow[]>(initialInvites);

  const stats = useMemo(() => {
    const approved = clips.filter((c) => c.status === "approved").length;
    const drafts = clips.filter((c) => c.status === "draft").length;
    const flagged = clips.filter((c) => c.status === "flagged").length;
    const activeInvites = invites.filter(
      (i) => !i.revoked_at && new Date(i.expires_at).getTime() > serverNowMs
    ).length;
    return { approved, drafts, flagged, activeInvites };
  }, [clips, invites, serverNowMs]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            <span>Miɗo Waawi Pular! · Audio Admin</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Audio Review & Speaker Invites
          </h1>
          {adminEmail && (
            <p className="text-xs text-muted-foreground">
              Signed in as {adminEmail}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Learner View
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="gap-1.5"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span>Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Summary KPIs */}
      <section
        aria-label="Audio pipeline summary"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Approved Clips
            </p>
            <p className="mt-1 text-2xl font-bold">
              {stats.approved}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {prompts.length}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Drafts Pending
            </p>
            <p className="mt-1 text-2xl font-bold">{stats.drafts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Flagged Notes
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-600">
              {stats.flagged}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Active Invites
            </p>
            <p className="mt-1 text-2xl font-bold">{stats.activeInvites}</p>
          </CardContent>
        </Card>
      </section>

      <main className="flex-1">
        <Tabs defaultValue="review" className="w-full gap-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="review" className="min-h-9 px-4">
              Review Clips ({stats.drafts + stats.flagged} pending)
            </TabsTrigger>
            <TabsTrigger value="invites" className="min-h-9 px-4">
              Speaker Invites ({stats.activeInvites} active)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review">
            <ClipReviewQueue
              prompts={prompts}
              clips={clips}
              onClipUpdated={(updated) =>
                setClips((prev) =>
                  prev.map((c) =>
                    c.clip_key === updated.clip_key ? updated : c
                  )
                )
              }
              onClipDeleted={(deletedKey) =>
                setClips((prev) => prev.filter((c) => c.clip_key !== deletedKey))
              }
            />
          </TabsContent>

          <TabsContent value="invites">
            <InviteManager
              competences={competences}
              invites={invites}
              nowMs={serverNowMs}
              onInviteCreated={(created) =>
                setInvites((prev) => [created, ...prev])
              }
              onInviteUpdated={(updated) =>
                setInvites((prev) =>
                  prev.map((i) => (i.id === updated.id ? updated : i))
                )
              }
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
