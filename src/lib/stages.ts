export const STAGES = [
  {
    id: "hunting",
    label: "Sowing Seeds",
    shortLabel: "Seeds",
    description: "People being prayed for, contacted, or invited.",
    tone: "amber",
  },
  {
    id: "first_bible_study",
    label: "First Bible Study",
    shortLabel: "1st Study",
    description: "The first study is scheduled or recently completed.",
    tone: "sky",
  },
  {
    id: "third_bible_study",
    label: "Third Bible Study",
    shortLabel: "3rd Study",
    description: "Momentum is building through the early lessons.",
    tone: "indigo",
  },
  {
    id: "seventh_bible_study",
    label: "Seventh Bible Study",
    shortLabel: "7th Study",
    description: "A consistent study rhythm is established.",
    tone: "violet",
  },
  {
    id: "ready_for_baptism",
    label: "Ready for Baptism",
    shortLabel: "Ready",
    description: "Final preparation, questions, and care before baptism.",
    tone: "emerald",
  },
  {
    id: "baptized",
    label: "Baptized",
    shortLabel: "Baptized",
    description: "Shown for the current month, then kept in history.",
    tone: "green",
  },
] as const;

export type Stage = (typeof STAGES)[number];
export type StageId = Stage["id"];

export const STAGE_IDS = STAGES.map((stage) => stage.id) as StageId[];

export function isStageId(value: string): value is StageId {
  return STAGE_IDS.includes(value as StageId);
}

export function getStageLabel(stageId: StageId) {
  return STAGES.find((stage) => stage.id === stageId)?.label ?? stageId;
}
