"use client";

import { useState } from "react";
import { Ban, Check, Copy, Link2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompetenceMeta, ContributorInviteRow } from "@/types/audio";

interface InviteManagerProps {
  competences: CompetenceMeta[];
  invites: ContributorInviteRow[];
  nowMs: number;
  onInviteCreated: (invite: ContributorInviteRow) => void;
  onInviteUpdated: (invite: ContributorInviteRow) => void;
}

export function InviteManager({
  competences,
  invites,
  nowMs,
  onInviteCreated,
  onInviteUpdated,
}: InviteManagerProps) {
  const [speakerName, setSpeakerName] = useState("");
  const [dialectRegion, setDialectRegion] = useState("");
  const [defaultCompetence, setDefaultCompetence] = useState<string>("1");
  const [expiresInDays, setExpiresInDays] = useState<string>("14");
  const [isCreating, setIsCreating] = useState(false);

  const [latestLink, setLatestLink] = useState<{
    speakerName: string;
    url: string;
  } | null>(null);
  const [copiedLatest, setCopiedLatest] = useState(false);

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevokeInvite, setConfirmRevokeInvite] =
    useState<ContributorInviteRow | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!speakerName.trim()) {
      toast.error("Please enter the speaker's name.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speakerName: speakerName.trim(),
          dialectRegion: dialectRegion.trim() || null,
          defaultCompetence:
            defaultCompetence === "all" ? null : Number(defaultCompetence),
          expiresInDays: Number(expiresInDays),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        invite?: ContributorInviteRow;
        inviteUrl?: string;
        error?: string;
      };

      if (!res.ok || !payload.invite || !payload.inviteUrl) {
        toast.error(payload.error ?? "Failed to generate invite link.");
        return;
      }

      onInviteCreated(payload.invite);
      setLatestLink({
        speakerName: payload.invite.speaker_name,
        url: payload.inviteUrl,
      });
      setCopiedLatest(false);
      setSpeakerName("");
      setDialectRegion("");
      toast.success("Speaker invite link created");
    } catch {
      toast.error("Network error while creating invite link.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLatest = async () => {
    if (!latestLink) return;
    try {
      await navigator.clipboard.writeText(latestLink.url);
      setCopiedLatest(true);
      toast.success("Invite link copied — ready to paste into WhatsApp");
      window.setTimeout(() => setCopiedLatest(false), 2500);
    } catch {
      toast.error("Could not copy automatically. Select and copy the link manually.");
    }
  };

  const handleConfirmRevoke = async () => {
    if (!confirmRevokeInvite) return;
    const target = confirmRevokeInvite;
    setConfirmRevokeInvite(null);
    setRevokingId(target.id);

    try {
      const res = await fetch("/api/admin/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, action: "revoke" }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        invite?: ContributorInviteRow;
        error?: string;
      };

      if (!res.ok || !payload.invite) {
        toast.error(payload.error ?? "Could not revoke invite.");
        return;
      }

      onInviteUpdated(payload.invite);
      toast.success(`Revoked invite for ${target.speaker_name}`);
    } catch {
      toast.error("Network error while revoking invite.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="size-4" aria-hidden="true" />
            Generate Contributor Invite Link
          </CardTitle>
          <CardDescription>
            Create a personal, revocable link to share via WhatsApp. Start new
            speakers with Competence 1 (15 greetings) as a quick mic check.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="speaker-name">Speaker name</Label>
              <Input
                id="speaker-name"
                required
                value={speakerName}
                onChange={(e) => setSpeakerName(e.target.value)}
                placeholder="e.g. Mamadou Diallo"
                className="min-h-10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dialect-region">
                Dialect / Region (optional)
              </Label>
              <Input
                id="dialect-region"
                value={dialectRegion}
                onChange={(e) => setDialectRegion(e.target.value)}
                placeholder="e.g. Labé, Timbo, Mamou"
                className="min-h-10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="default-competence">Starting batch</Label>
              <Select
                value={defaultCompetence}
                onValueChange={(val) => setDefaultCompetence(val ?? "1")}
              >
                <SelectTrigger id="default-competence" className="min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {competences.map((c) => (
                    <SelectItem key={c.number} value={String(c.number)}>
                      Competence {c.number}: {c.title} ({c.totalClipCount} clips)
                    </SelectItem>
                  ))}
                  <SelectItem value="all">
                    All Competences 1–3 (63 clips)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expires-days">Link expiration</Label>
              <Select
                value={expiresInDays}
                onValueChange={(val) => setExpiresInDays(val ?? "14")}
              >
                <SelectTrigger id="expires-days" className="min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days (Recommended)</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={isCreating}
                className="min-h-10 gap-2"
              >
                {isCreating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                <span>Create Speaker Link</span>
              </Button>
            </div>
          </form>

          {latestLink && (
            <Alert className="border-emerald-500/40 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">
              <AlertTitle className="font-semibold">
                Invite link for {latestLink.speakerName} (shown once)
              </AlertTitle>
              <AlertDescription className="mt-2 flex flex-col gap-2">
                <p className="break-all rounded-md border bg-background p-2 font-mono text-xs text-foreground">
                  {latestLink.url}
                </p>
                <div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopyLatest}
                    className="min-h-9 gap-1.5"
                  >
                    {copiedLatest ? (
                      <>
                        <Check className="size-4" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" aria-hidden="true" />
                        Copy Invite Link
                      </>
                    )}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Issued Speaker Invites</CardTitle>
          <CardDescription>
            Revoking a link immediately invalidates the speaker&apos;s browser
            session and blocks further uploads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No speaker invite links generated yet.
            </p>
          ) : (
            <ul role="list" className="flex flex-col gap-2.5">
              {invites.map((invite) => {
                const isRevoked = Boolean(invite.revoked_at);
                const isExpired =
                  !isRevoked &&
                  new Date(invite.expires_at).getTime() <= nowMs;
                const isActive = !isRevoked && !isExpired;

                return (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {invite.speaker_name}
                        </span>
                        {invite.dialect_region && (
                          <Badge variant="outline">{invite.dialect_region}</Badge>
                        )}
                        {invite.default_competence && (
                          <Badge variant="secondary">
                            Competence {invite.default_competence}
                          </Badge>
                        )}
                        {isActive && (
                          <Badge className="bg-emerald-600 text-white">
                            Active
                          </Badge>
                        )}
                        {isRevoked && (
                          <Badge variant="destructive">Revoked</Badge>
                        )}
                        {isExpired && (
                          <Badge variant="secondary">Expired</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Expires{" "}
                        {new Date(invite.expires_at).toLocaleDateString()} ·{" "}
                        {invite.last_used_at
                          ? `Last active ${new Date(invite.last_used_at).toLocaleDateString()}`
                          : "Not opened yet"}
                      </p>
                    </div>

                    {isActive && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={revokingId === invite.id}
                        onClick={() => setConfirmRevokeInvite(invite)}
                        aria-label={`Revoke invite for ${invite.speaker_name}`}
                        className="min-h-9 gap-1.5"
                      >
                        {revokingId === invite.id ? (
                          <Loader2
                            className="size-3.5 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Ban className="size-3.5" aria-hidden="true" />
                        )}
                        <span>Revoke</span>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(confirmRevokeInvite)}
        onOpenChange={(open) => {
          if (!open) setConfirmRevokeInvite(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke speaker invite?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRevokeInvite?.speaker_name} will immediately lose access to
              the Contributor Recorder. Any clips they already recorded remain
              safely stored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRevoke}>
              Revoke Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
