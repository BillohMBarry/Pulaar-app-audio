import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CONTRIBUTOR_COOKIE_NAME,
  getContributorCookieOptions,
  hashInviteToken,
  signContributorCookie,
} from "@/lib/auth/contributor-session";

/**
 * POST /api/contribute/session
 * Exchanges a revocable speaker invite token for an HttpOnly signed cookie.
 * Using POST (never GET) prevents WhatsApp / iMessage link-preview bots from
 * touching or activating speaker sessions.
 */
export async function POST(request: Request) {
  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const rawToken = typeof body.token === "string" ? body.token.trim() : "";
  if (!rawToken || rawToken.length < 16) {
    return NextResponse.json(
      { error: "Invalid or missing invite link." },
      { status: 400 }
    );
  }

  try {
    const tokenHash = hashInviteToken(rawToken);
    const supabase = createAdminClient();

    const { data: invite, error } = await supabase
      .from("contributor_invites")
      .select(
        "id, speaker_name, dialect_region, default_competence, expires_at, revoked_at"
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Unable to verify invite link right now." },
        { status: 500 }
      );
    }

    if (!invite) {
      return NextResponse.json(
        { error: "This recording invite link was not recognized." },
        { status: 401 }
      );
    }

    if (invite.revoked_at) {
      return NextResponse.json(
        {
          error:
            "This recording invite link has been revoked. Please ask the coordinator for a new link.",
        },
        { status: 401 }
      );
    }

    const expiresAt = new Date(invite.expires_at);
    if (expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        {
          error:
            "This recording invite link has expired. Please ask the coordinator for a fresh link.",
        },
        { status: 401 }
      );
    }

    // Record last usage timestamp
    await supabase
      .from("contributor_invites")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", invite.id);

    const cookieValue = signContributorCookie({
      inviteId: invite.id,
      exp: Math.floor(expiresAt.getTime() / 1000),
    });

    const response = NextResponse.json({
      session: {
        inviteId: invite.id,
        speakerName: invite.speaker_name,
        dialectRegion: invite.dialect_region,
        defaultCompetence: invite.default_competence,
      },
    });

    response.cookies.set(
      CONTRIBUTOR_COOKIE_NAME,
      cookieValue,
      getContributorCookieOptions(expiresAt)
    );

    return response;
  } catch (err) {
    console.error("Contributor session exchange error:", err);
    return NextResponse.json(
      { error: "Server configuration error while verifying invite." },
      { status: 500 }
    );
  }
}
