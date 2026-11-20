import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getAdminUser } from "@/lib/auth/admin";
import { getCompetences, getRecordingPrompts } from "@/lib/curriculum";
import { createClient } from "@/lib/server";
import type { AudioClipRow, ContributorInviteRow } from "@/types/audio";

export const metadata: Metadata = {
  title: "Admin — Clip Review & Invites",
};

async function loadAdminDashboardData() {
  const supabase = await createClient();
  const [{ data: clips }, { data: invites }] = await Promise.all([
    supabase.from("audio_clips").select("*").order("updated_at", {
      ascending: false,
    }),
    supabase
      .from("contributor_invites")
      .select(
        "id, speaker_name, dialect_region, default_competence, expires_at, revoked_at, last_used_at, created_at"
      )
      .order("created_at", { ascending: false }),
  ]);

  return {
    clips: (clips as AudioClipRow[] | null) ?? [],
    invites: (invites as ContributorInviteRow[] | null) ?? [],
    serverNowMs: Date.now(),
  };
}

async function AdminContent() {
  await connection();

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect("/auth/login?next=/admin");
  }

  const admin = await getAdminUser();
  if (!admin) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert
                className="size-6 text-destructive"
                aria-hidden="true"
              />
            </div>
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>
              You are signed in as {userData.user.email}, which does not have
              the <code className="font-mono">admin</code> role in Supabase{" "}
              <code className="font-mono">app_metadata</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Return to Vocabulary Library
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { clips, invites, serverNowMs } = await loadAdminDashboardData();

  return (
    <AdminDashboard
      adminEmail={admin.email}
      competences={getCompetences()}
      prompts={getRecordingPrompts()}
      initialClips={clips}
      initialInvites={invites}
      serverNowMs={serverNowMs}
    />
  );
}

function AdminFallback() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <Skeleton className="h-12 w-72" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminContent />
    </Suspense>
  );
}
