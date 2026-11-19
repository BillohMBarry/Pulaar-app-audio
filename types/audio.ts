export type CompetenceNumber = 1 | 2 | 3;

export type ClipStatus = "draft" | "approved" | "rejected" | "flagged";

export type AllowedMimeType =
  | "audio/mp4"
  | "audio/webm"
  | "audio/mpeg"
  | "audio/ogg";

export type AllowedFileExt = "mp4" | "webm" | "mp3" | "ogg";

export interface CompetenceMeta {
  number: CompetenceNumber;
  title: string;
  pularTitle: string;
  englishSubtitle: string;
  baseCount: number;
  pluralCount: number;
  totalClipCount: number;
}

/**
 * Clean human-readable prompt model rendered in the Contributor Recorder.
 * Raw JSON field names and internal snake_case slugs are never exposed in UI text.
 */
export interface RecordingPromptItem {
  clipKey: string;
  vocabId: string;
  isPlural: boolean;
  competence: CompetenceNumber;
  competenceTitle: string;
  categoryLabel: string;
  pularText: string;
  asciiSearchText: string;
  englishText: string;
  partOfSpeechLabel: string;
  registerLabel: string;
  singularReference: string | null;
  pluralReference: string | null;
  usageNote: string;
  orderIndex: number;
}

/**
 * Learner-facing vocabulary card model (45 entries across Competences 1-3).
 * v01's plural form ("On jaraama.") aliases to v02 so Competence 1 stays at 15 clips.
 */
export interface LearnerVocabularyItem {
  vocabId: string;
  baseClipKey: string;
  pluralClipKey: string | null;
  competence: CompetenceNumber;
  competenceTitle: string;
  categoryLabel: string;
  pular: string;
  asciiSearchText: string;
  english: string;
  partOfSpeechLabel: string;
  registerLabel: string;
  pluralForm: string | null;
  usageNote: string;
}

export interface AudioClipRow {
  id: number;
  clip_key: string;
  vocab_id: string;
  is_plural: boolean;
  competence: CompetenceNumber;
  status: ClipStatus;
  storage_path: string | null;
  public_url: string | null;
  mime_type: AllowedMimeType | null;
  file_ext: AllowedFileExt | null;
  duration_ms: number | null;
  file_size_bytes: number | null;
  dialect_note: string | null;
  review_note: string | null;
  invite_id: string | null;
  speaker_name: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContributorInviteRow {
  id: string;
  speaker_name: string;
  dialect_region: string | null;
  default_competence: CompetenceNumber | null;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface ContributorSessionInfo {
  inviteId: string;
  speakerName: string;
  dialectRegion: string | null;
  defaultCompetence: CompetenceNumber | null;
}
