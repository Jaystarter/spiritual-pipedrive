export const STAGE_TONE_NAMES = [
  "amber",
  "sky",
  "indigo",
  "violet",
  "emerald",
  "green",
] as const;

export type StageToneName = (typeof STAGE_TONE_NAMES)[number];

export type StageId = string;

export type Stage = {
  id: StageId;
  label: string;
  shortLabel: string;
  description: string;
  tone: StageToneName;
  sortOrder: number;
  isHidden: boolean;
  isSystem: boolean;
};

export const DEFAULT_STAGES: Stage[] = [
  {
    id: "hunting",
    label: "Sowing Seeds",
    shortLabel: "Seeds",
    description: "People being prayed for, contacted, or invited.",
    tone: "amber",
    sortOrder: 1000,
    isHidden: false,
    isSystem: true,
  },
  {
    id: "first_bible_study",
    label: "First Bible Study",
    shortLabel: "1st Study",
    description: "The first study is scheduled or recently completed.",
    tone: "sky",
    sortOrder: 2000,
    isHidden: false,
    isSystem: true,
  },
  {
    id: "third_bible_study",
    label: "Third Bible Study",
    shortLabel: "3rd Study",
    description: "Momentum is building through the early lessons.",
    tone: "indigo",
    sortOrder: 3000,
    isHidden: false,
    isSystem: true,
  },
  {
    id: "seventh_bible_study",
    label: "Seventh Bible Study",
    shortLabel: "7th Study",
    description: "A consistent study rhythm is established.",
    tone: "violet",
    sortOrder: 4000,
    isHidden: false,
    isSystem: true,
  },
  {
    id: "ready_for_baptism",
    label: "Ready for Baptism",
    shortLabel: "Ready",
    description: "Final preparation, questions, and care before baptism.",
    tone: "emerald",
    sortOrder: 5000,
    isHidden: false,
    isSystem: true,
  },
  {
    id: "baptized",
    label: "Baptized",
    shortLabel: "Baptized",
    description: "Legacy baptized lane; existing contacts are moved into Baptized.",
    tone: "green",
    sortOrder: 6000,
    isHidden: true,
    isSystem: true,
  },
  {
    id: "brothers",
    label: "Baptized",
    shortLabel: "Baptized",
    description: "Baptized contacts continuing in care and service.",
    tone: "green",
    sortOrder: 7000,
    isHidden: false,
    isSystem: true,
  },
  {
    id: "archive",
    label: "Archive",
    shortLabel: "Archive",
    description: "Set aside — no longer actively studying.",
    tone: "violet",
    sortOrder: 8000,
    isHidden: false,
    isSystem: true,
  },
] satisfies Stage[];

export const STAGES = DEFAULT_STAGES;

export const DEFAULT_STAGE_IDS = DEFAULT_STAGES.map((stage) => stage.id);
export const DEFAULT_STAGE_BY_ID = new Map(
  DEFAULT_STAGES.map((stage) => [stage.id, stage])
);

export const MANUAL_ONLY_STAGE_IDS = [
  "ready_for_baptism",
  "baptized",
  "brothers",
  "archive",
] as const;

export function isManualOnlyStage(stageId: StageId) {
  return MANUAL_ONLY_STAGE_IDS.includes(
    stageId as (typeof MANUAL_ONLY_STAGE_IDS)[number]
  );
}

export function getAutomaticStudyStageId(studyCount: number): StageId {
  const completedStudies = Math.max(0, Math.trunc(studyCount));

  // Study milestones drive only the early journey stages; final stages stay manual.
  if (completedStudies >= 7) {
    return "seventh_bible_study";
  }

  if (completedStudies >= 3) {
    return "third_bible_study";
  }

  if (completedStudies >= 1) {
    return "first_bible_study";
  }

  return "hunting";
}

export function isStageId(value: string): value is StageId {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
}

export function isStageToneName(value: string): value is StageToneName {
  return STAGE_TONE_NAMES.includes(value as StageToneName);
}

export function normalizeStages(stages: Stage[]) {
  const seen = new Set<string>();
  const uniqueStages = stages.filter((stage) => {
    if (!isStageId(stage.id) || seen.has(stage.id)) {
      return false;
    }

    seen.add(stage.id);
    return true;
  });
  const stagesWithMissingDefaults = [
    ...uniqueStages,
    ...DEFAULT_STAGES.filter((stage) => !seen.has(stage.id)),
  ];
  const normalized = stagesWithMissingDefaults
    .map((stage) => {
      return {
        ...stage,
        label: cleanStageLabel(stage.label) || humanizeStageId(stage.id),
        shortLabel:
          cleanStageShortLabel(stage.shortLabel) ||
          cleanStageLabel(stage.label) ||
          humanizeStageId(stage.id),
        description: cleanStageDescription(stage.description),
        tone: isStageToneName(stage.tone) ? stage.tone : getFallbackTone(stage.sortOrder),
        sortOrder: Number.isFinite(stage.sortOrder) ? stage.sortOrder : 0,
        isHidden: Boolean(stage.isHidden),
        isSystem: Boolean(stage.isSystem),
      };
    })
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }

      return a.label.localeCompare(b.label);
    });

  return normalized.length > 0 ? normalized : DEFAULT_STAGES;
}

export function getVisibleStages(stages: Stage[]) {
  return normalizeStages(stages).filter((stage) => !stage.isHidden);
}

export function getStageLabel(stageId: StageId, stages: Stage[] = DEFAULT_STAGES) {
  return normalizeStages(stages).find((stage) => stage.id === stageId)?.label ?? stageId;
}

export function cleanStageLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 48);
}

export function cleanStageShortLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 24);
}

export function cleanStageDescription(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 140);
}

export function createStageId(label: string, existingIds: Iterable<string>) {
  const existing = new Set(existingIds);
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "custom_stack";
  let id = base;
  let suffix = 2;

  while (existing.has(id)) {
    const nextSuffix = `_${suffix}`;
    id = `${base.slice(0, 64 - nextSuffix.length)}${nextSuffix}`;
    suffix += 1;
  }

  return id;
}

export function getFallbackTone(order: number): StageToneName {
  const index = Math.abs(Math.trunc(order / 1000)) % STAGE_TONE_NAMES.length;

  return STAGE_TONE_NAMES[index] ?? "sky";
}

function humanizeStageId(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
