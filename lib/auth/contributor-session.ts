import crypto from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CompetenceNumber, ContributorSessionInfo } from "@/types/audio";

export const CONTRIBUTOR_COOKIE_NAME = "pular_contributor_session";

interface CookiePayload {
  inviteId: string;
  exp: number; // unix epoch seconds
}

function getSessionSecret(): string {
  const secret = process.env.CONTRIBUTOR_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "Missing or too-short CONTRIBUTOR_SESSION_SECRET environment variable."
    );
  }
  return secret;
}

export function hashInviteToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

export function generateRawInviteToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function signContributorCookie(payload: CookiePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyContributorCookieValue(
  rawCookie: string | undefined
): CookiePayload | null {
  if (!rawCookie) return null;
  const parts = rawCookie.split(".");
  if (parts.length !== 2) return null;

  const [encoded, providedSig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");

  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as CookiePayload;
    if (
      typeof parsed.inviteId !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getContributorCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

/**
 * Validates the HttpOnly contributor cookie AND checks the database so
 * revoked or expired links take effect immediately.
 */
export async function getVerifiedContributorSession(): Promise<ContributorSessionInfo | null> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(CONTRIBUTOR_COOKIE_NAME)?.value;
  const payload = verifyContributorCookieValue(rawCookie);
  if (!payload) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contributor_invites")
    .select(
      "id, speaker_name, dialect_region, default_competence, expires_at, revoked_at"
    )
    .eq("id", payload.inviteId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;

  return {
    inviteId: data.id,
    speakerName: data.speaker_name,
    dialectRegion: data.dialect_region,
    defaultCompetence:
      (data.default_competence as CompetenceNumber | null) ?? null,
  };
}
