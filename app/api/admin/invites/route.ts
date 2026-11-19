import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import {
  generateRawInviteToken,
  hashInviteToken,
} from "@/lib/auth/contributor-session";
import { createClient } from "@/lib/server";

/**
 * GET /api/admin/invites — List all speaker invite links.
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contributor_invites")
    .select(
      "id, speaker_name, dialect_region, default_competence, expires_at, revoked_at, last_used_at, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load invites." },
      { status: 500 }
    );
  }

  return NextResponse.json({ invites: data ?? [] });
}

/**
 * POST /api/admin/invites — Create a revocable per-speaker invite link.
 * Returns the raw token URL ONCE; only its SHA-256 hash is stored in Postgres.
 */
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: {
    speakerName?: unknown;
    dialectRegion?: unknown;
    defaultCompetence?: unknown;
    expiresInDays?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const speakerName =
    typeof body.speakerName === "string" ? body.speakerName.trim() : "";
  if (!speakerName || speakerName.length > 120) {
    return NextResponse.json(
      { error: "Please enter the speaker's name." },
      { status: 400 }
    );
  }

  const dialectRegion =
    typeof body.dialectRegion === "string" && body.dialectRegion.trim()
      ? body.dialectRegion.trim().slice(0, 120)
      : null;

  const rawComp = Number(body.defaultCompetence);
  const defaultCompetence =
    rawComp === 1 || rawComp === 2 || rawComp === 3 ? rawComp : null;

  const rawDays = Number(body.expiresInDays);
  const expiresInDays =
    Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 90 ? rawDays : 14;
  const expiresAt = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const rawToken = generateRawInviteToken();
  const tokenHash = hashInviteToken(rawToken);

  const supabase = await createClient();
  const { data: invite, error } = await supabase
    .from("contributor_invites")
    .insert({
      token_hash: tokenHash,
      speaker_name: speakerName,
      dialect_region: dialectRegion,
      default_competence: defaultCompetence,
      expires_at: expiresAt,
      created_by: admin.id,
    })
    .select(
      "id, speaker_name, dialect_region, default_competence, expires_at, revoked_at, last_used_at, created_at"
    )
    .single();

  if (error || !invite) {
    console.error("Failed to create invite:", error);
    return NextResponse.json(
      { error: "Could not create invite link." },
      { status: 500 }
    );
  }

  const origin = new URL(request.url).origin;
  const params = new URLSearchParams({ token: rawToken });
  if (defaultCompetence) {
    params.set("competence", String(defaultCompetence));
  }
  const inviteUrl = `${origin}/contribute?${params.toString()}`;

  return NextResponse.json({ invite, inviteUrl }, { status: 201 });
}

/**
 * PATCH /api/admin/invites — Revoke an active invite link immediately.
 */
export async function PATCH(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: { id?: unknown; action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || body.action !== "revoke") {
    return NextResponse.json(
      { error: "Invalid revoke request." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: invite, error } = await supabase
    .from("contributor_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .select(
      "id, speaker_name, dialect_region, default_competence, expires_at, revoked_at, last_used_at, created_at"
    )
    .single();

  if (error || !invite) {
    return NextResponse.json(
      { error: "Could not revoke invite." },
      { status: 500 }
    );
  }

  return NextResponse.json({ invite });
}
