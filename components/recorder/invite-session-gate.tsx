"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface InviteSessionGateProps {
  tokenFromUrl: string | null;
  competenceParam: string | null;
}

/**
 * Exchanges a ?token=... query parameter via POST /api/contribute/session into
 * an HttpOnly cookie, then strips the token from the browser URL.
 * Performing token activation on POST (not GET) prevents WhatsApp/iMessage link
 * preview crawlers from activating or touching speaker sessions.
 */
export function InviteSessionGate({
  tokenFromUrl,
  competenceParam,
}: InviteSessionGateProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "verifying" | "error">(
    tokenFromUrl ? "verifying" : "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  const exchangeToken = useCallback(async () => {
    if (!tokenFromUrl) return;
    setStatus("verifying");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/contribute/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenFromUrl }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        session?: { defaultCompetence?: number | null };
        error?: string;
      };

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(
          payload.error ??
            "This recording link is invalid or has expired. Please request a fresh link."
        );
        return;
      }

      const targetCompetence =
        competenceParam ??
        (payload.session?.defaultCompetence
          ? String(payload.session.defaultCompetence)
          : null);

      const cleanUrl = targetCompetence
        ? `/contribute?competence=${encodeURIComponent(targetCompetence)}`
        : "/contribute";

      router.replace(cleanUrl);
      router.refresh();
    } catch {
      setStatus("error");
      setErrorMessage(
        "Could not reach the server to verify your link. Check your internet connection and retry."
      );
    }
  }, [tokenFromUrl, competenceParam, router]);

  useEffect(() => {
    if (!tokenFromUrl || startedRef.current) return;
    startedRef.current = true;
    void exchangeToken();
  }, [tokenFromUrl, exchangeToken]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            {status === "verifying" ? (
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            ) : (
              <KeyRound className="size-6 text-primary" aria-hidden="true" />
            )}
          </div>
          <CardTitle className="text-xl">
            {status === "verifying"
              ? "Opening Your Recording Session"
              : "Speaker Invite Link Required"}
          </CardTitle>
          <CardDescription>
            {status === "verifying"
              ? "Verifying your personal contributor link…"
              : "To record Pular vocabulary clips, open the personal invite link shared with you by the project coordinator."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status === "error" && errorMessage && (
            <Alert variant="destructive">
              <AlertTitle>Link Not Active</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {tokenFromUrl && status === "error" && (
            <Button
              type="button"
              onClick={exchangeToken}
              className="min-h-11 w-full gap-2"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Try Opening Link Again
            </Button>
          )}

          <div className="text-center">
            <Link
              href="/"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Browse Pular Vocabulary Library
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
