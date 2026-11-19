import curriculumData from "@/curriculum-v2.json";
import type {
  CompetenceMeta,
  CompetenceNumber,
  LearnerVocabularyItem,
  RecordingPromptItem,
} from "@/types/audio";

interface RawCompetence {
  id: string;
  number: number;
  title: string;
  pular_title: string;
  english_subtitle: string;
}

interface RawVocabulary {
  id: string;
  competence: number;
  category: string;
  pular: string;
  ascii: string;
  english: string;
  part_of_speech: string;
  register: string;
  plural_form: string | null;
  usage_note: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  basic_greetings: "Basic Greetings",
  greeting_questions: "Greeting Questions",
  alternatives_to_jam_tun: "Alternatives to Jam tun",
  taking_leave: "Taking Leave",
  polite_words: "Polite Words",
  beginner_phrases: "Beginner Phrases",
  introductions_phrasebook: "Introductions Phrasebook",
  key_words: "Key Words",
  occupations: "Occupations",
  nationalities_ethnicities: "Nationalities & Ethnicities",
  social_roles: "Social Roles",
  family_members: "Family Members",
  family_phrasebook: "Family Phrasebook",
};

const REGISTER_LABELS: Record<string, string> = {
  familiar_singular: "Familiar (Singular)",
  respectful_or_plural: "Respectful / Plural",
  respectful: "Respectful",
  casual: "Casual",
  neutral: "Neutral",
};

const POS_LABELS: Record<string, string> = {
  phrase: "Phrase",
  noun: "Noun",
  interjection: "Interjection",
  particle: "Particle",
};

/**
 * Aliases for plural forms that duplicate an existing base entry.
 * v01 ("A jaraama.") has plural_form "On jaraama.", which is identical to v02.
 * Aliasing keeps Competence 1 at exactly 15 unique greeting recordings.
 */
export const PLURAL_CLIP_ALIASES: Record<string, string> = {
  v01: "v02",
};

function formatFallbackSlug(slug: string): string {
  return slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getCategoryLabel(slug: string): string {
  return CATEGORY_LABELS[slug] ?? formatFallbackSlug(slug);
}

function getRegisterLabel(slug: string): string {
  return REGISTER_LABELS[slug] ?? formatFallbackSlug(slug);
}

function getPosLabel(slug: string): string {
  return POS_LABELS[slug] ?? formatFallbackSlug(slug);
}

function toAscii(text: string): string {
  return text
    .replaceAll("ɓ", "b")
    .replaceAll("Ɓ", "B")
    .replaceAll("ɗ", "d")
    .replaceAll("Ɗ", "D")
    .replaceAll("ƴ", "y")
    .replaceAll("Ƴ", "Y")
    .replaceAll("ñ", "n")
    .replaceAll("Ñ", "N")
    .replaceAll("ŋ", "ng")
    .replaceAll("Ŋ", "Ng");
}

const rawCompetences = (curriculumData.competences as RawCompetence[]).filter(
  (c) => c.number === 1 || c.number === 2 || c.number === 3
);

const competenceTitleByNumber = new Map<CompetenceNumber, string>(
  rawCompetences.map((c) => [c.number as CompetenceNumber, c.title])
);

const rawVocab = (curriculumData.vocabulary as RawVocabulary[]).filter(
  (v) => v.competence === 1 || v.competence === 2 || v.competence === 3
);

const ALL_LEARNER_VOCABULARY: LearnerVocabularyItem[] = rawVocab.map((item) => {
  const competence = item.competence as CompetenceNumber;
  const aliasedPluralKey = PLURAL_CLIP_ALIASES[item.id];
  const pluralClipKey = item.plural_form
    ? aliasedPluralKey ?? `${item.id}_plural`
    : null;

  return {
    vocabId: item.id,
    baseClipKey: item.id,
    pluralClipKey,
    competence,
    competenceTitle:
      competenceTitleByNumber.get(competence) ?? `Competence ${competence}`,
    categoryLabel: getCategoryLabel(item.category),
    pular: item.pular,
    asciiSearchText: `${item.ascii} ${item.plural_form ? toAscii(item.plural_form) : ""}`.trim(),
    english: item.english,
    partOfSpeechLabel: getPosLabel(item.part_of_speech),
    registerLabel: getRegisterLabel(item.register),
    pluralForm: item.plural_form,
    usageNote: item.usage_note,
  };
});

const ALL_RECORDING_PROMPTS: RecordingPromptItem[] = (() => {
  const prompts: RecordingPromptItem[] = [];
  let orderIndex = 0;

  for (const item of rawVocab) {
    const competence = item.competence as CompetenceNumber;
    const competenceTitle =
      competenceTitleByNumber.get(competence) ?? `Competence ${competence}`;
    const categoryLabel = getCategoryLabel(item.category);
    const registerLabel = getRegisterLabel(item.register);
    const partOfSpeechLabel = getPosLabel(item.part_of_speech);

    prompts.push({
      clipKey: item.id,
      vocabId: item.id,
      isPlural: false,
      competence,
      competenceTitle,
      categoryLabel,
      pularText: item.pular,
      asciiSearchText: item.ascii,
      englishText: item.english,
      partOfSpeechLabel,
      registerLabel,
      singularReference: null,
      pluralReference: item.plural_form,
      usageNote: item.usage_note,
      orderIndex: orderIndex++,
    });

    // Generate separate plural clip unless aliased to an existing entry (v01 -> v02)
    if (item.plural_form && !PLURAL_CLIP_ALIASES[item.id]) {
      prompts.push({
        clipKey: `${item.id}_plural`,
        vocabId: item.id,
        isPlural: true,
        competence,
        competenceTitle,
        categoryLabel,
        pularText: item.plural_form,
        asciiSearchText: toAscii(item.plural_form),
        englishText: `${item.english} (plural form)`,
        partOfSpeechLabel,
        registerLabel: "Plural Form",
        singularReference: item.pular,
        pluralReference: null,
        usageNote: `Plural of "${item.pular}". ${item.usage_note}`,
        orderIndex: orderIndex++,
      });
    }
  }

  return prompts;
})();

const PROMPT_BY_CLIP_KEY = new Map<string, RecordingPromptItem>(
  ALL_RECORDING_PROMPTS.map((prompt) => [prompt.clipKey, prompt])
);

const ALL_COMPETENCES: CompetenceMeta[] = rawCompetences.map((comp) => {
  const num = comp.number as CompetenceNumber;
  const items = ALL_RECORDING_PROMPTS.filter((p) => p.competence === num);
  const baseCount = items.filter((p) => !p.isPlural).length;
  const pluralCount = items.filter((p) => p.isPlural).length;

  return {
    number: num,
    title: comp.title,
    pularTitle: comp.pular_title,
    englishSubtitle: comp.english_subtitle,
    baseCount,
    pluralCount,
    totalClipCount: items.length,
  };
});

export function parseCompetenceParam(
  value: string | string[] | null | undefined
): CompetenceNumber | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "1") return 1;
  if (raw === "2") return 2;
  if (raw === "3") return 3;
  return undefined;
}

export function getCompetences(): CompetenceMeta[] {
  return ALL_COMPETENCES;
}

export function getRecordingPrompts(
  competence?: CompetenceNumber
): RecordingPromptItem[] {
  if (!competence) return ALL_RECORDING_PROMPTS;
  return ALL_RECORDING_PROMPTS.filter((p) => p.competence === competence);
}

export function getLearnerVocabulary(
  competence?: CompetenceNumber
): LearnerVocabularyItem[] {
  if (!competence) return ALL_LEARNER_VOCABULARY;
  return ALL_LEARNER_VOCABULARY.filter((v) => v.competence === competence);
}

export function getPromptByClipKey(
  clipKey: string
): RecordingPromptItem | undefined {
  return PROMPT_BY_CLIP_KEY.get(clipKey);
}

export function getTotalRecordingCount(): number {
  return ALL_RECORDING_PROMPTS.length;
}
