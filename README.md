# Miɗo Waawi Pular!

Miɗo Waawi Pular! is a mobile-first contribution app for collecting clear, native Pular (Fuuta Jallon) audio recordings to support Pular learning applications and improve audio where AI-generated speech is not yet clear or accurate.

- A searchable learner library for Competences 1–3
- Optional native-speaker playback for approved recordings
- Invite-based recording sessions for native speakers
- Admin tools for managing invites and reviewing clips
- Supabase-backed Storage and Postgres security rules

The learner-facing interface supports Pular and ASCII-text search, and the recording workflow supports browser-native MP4, WebM, MP3, and Ogg audio.

## Features

### Learner vocabulary

- Browse 45 vocabulary entries across three competences
- Filter by competence or search Pular, ASCII, English, or category text
- Group entries by curriculum category
- Play approved singular and plural recordings
- Show a clear “Audio soon” state for entries without approved audio

### Contributor recording

- Open a revocable, expiring per-speaker invite link
- Record or upload one clip at a time in small competence batches
- Resume the first unrecorded item automatically
- Save recordings as drafts with optional dialect notes
- Preserve a recorded clip in memory for retry after an upload failure
- Upload `.mp4`, `.webm`, `.mp3`, or `.ogg` files up to 5 MB
- Record separate plural forms where the curriculum requires them

### Administration

- Sign in with a Supabase Auth account that has the `admin` app role
- Create speaker invites with an expiry and default competence
- Copy or revoke invite links immediately
- Review draft, approved, rejected, and flagged clips
- Approve, reject, flag, or delete recordings

## Technology

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth, Postgres, Storage, and SSR
- Howler.js for browser playback
- shadcn/ui and Base UI primitives
- Lucide icons

## Project structure

```text
app/
  page.tsx                 Learner vocabulary library
  contribute/page.tsx      Invite-gated contributor recorder
  admin/page.tsx           Admin dashboard
  auth/login/page.tsx      Admin sign-in
  api/                     Admin and contributor route handlers
components/
  learner/                 Learner browser
  recorder/                Recording, batch, and accessibility UI
  admin/                   Invite and clip-review management
lib/
  curriculum.ts            Curriculum-to-UI model conversion
  auth/                    Admin and contributor session checks
  audio/                   MIME and playback helpers
  supabase/                Supplied Supabase clients
supabase/sql/
  001_pular_audio_schema.sql
types/
  audio.ts                 Shared domain types
curriculum-v2.json         Source curriculum data
```

## Prerequisites

- Node.js 20.9 or newer
- npm
- A Supabase project

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   SUPABASE_SECRET_KEY=your-server-only-secret-key
   CONTRIBUTOR_SESSION_SECRET=replace-with-at-least-16-random-characters
   ```

   `SUPABASE_SECRET_KEY` and `CONTRIBUTOR_SESSION_SECRET` must never be exposed to browser code or committed to source control.

3. In the Supabase SQL Editor, run:

   ```text
   supabase/sql/001_pular_audio_schema.sql
   ```

   This creates the `pular-audio` public Storage bucket, `contributor_invites` and `audio_clips` tables, indexes, RLS policies, and the `updated_at` trigger.

4. Create an admin user in Supabase Authentication, then promote that user's Auth account:

   ```sql
   update auth.users
   set raw_app_meta_data =
     coalesce(raw_app_meta_data, '{}'::jsonb)
     || '{"role": "admin"}'::jsonb
   where email = 'your-admin@example.com';
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open:

   - `http://localhost:3000` for the vocabulary library
   - `http://localhost:3000/auth/login` for admin sign-in
   - `http://localhost:3000/admin` for clip and invite management

## Environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Supabase publishable/browser key |
| `SUPABASE_SECRET_KEY` | Server only | Server-side Supabase operations, signed uploads, and metadata writes |
| `CONTRIBUTOR_SESSION_SECRET` | Server only | HMAC-signing of contributor session cookies |

Generate a contributor session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Recording workflow

1. An admin creates a contributor invite from `/admin`.
2. The invite URL contains a one-time-use raw token in the query string.
3. When the speaker activates the link, the browser exchanges the token with `POST /api/contribute/session`.
4. The server stores only an SHA-256 token hash in Postgres and issues an HttpOnly signed cookie.
5. The contributor selects Competence 1, 2, or 3, or uses the invite's default competence.
6. The browser requests a short-lived signed upload URL.
7. The audio is uploaded directly to the `pular-audio` Supabase bucket.
8. The server verifies the clip key, format, size, and storage path, then creates or updates an `audio_clips` row with `draft` status.
9. An admin approves or rejects the clip in `/admin`.
10. Only approved clips are returned to the public learner interface.

Revoking or expiring an invite invalidates existing contributor access immediately. Raw invite tokens are never stored in the database.

## Supabase Storage and database

The audio bucket accepts:

- `audio/mp4`
- `audio/webm`
- `audio/mpeg`
- `audio/ogg`

The maximum upload size is 5 MB. Files are stored under:

```text
vocab/comp-<1|2|3>/<clip-key>.<mp4|webm|mp3|ogg>
```

Postgres uses RLS to:

- Expose only approved `audio_clips` rows to learners
- Restrict contributor storage and metadata writes to server-side operations
- Give full clip and invite access only to users with `app_metadata.role === "admin"`

The curriculum currently produces 63 recording keys: 45 base vocabulary entries plus 18 distinct plural prompts. `v01`'s plural form aliases to `v02` so it does not create a duplicate recording.

## Scripts

```bash
npm run dev      # Start Next.js development mode
npm run build    # Create an optimized production build
npm run start    # Run the production build
npm run lint     # Run ESLint
```

## Verification

Before deploying or opening a pull request, run:

```bash
npm run lint
npm run build
```

## Deployment

The application can be deployed on any platform that supports Next.js 16 and server-side environment variables.

Before deploying:

1. Configure all four environment variables.
2. Run the Supabase SQL migration.
3. Create and promote the admin user.
4. Confirm the `pular-audio` bucket is public for reads and restricted for writes.
5. Verify the public learner page, admin sign-in, contributor invite flow, and approved-clip playback.
