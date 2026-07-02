import type { BoardPerson, BoardProfile, PersonEvent } from "@/app/actions";
import type { Stage, StageId } from "@/lib/stages";

export type BoardProps = {
  initialPeople: BoardPerson[];
  initialProfiles: BoardProfile[];
  initialStages: Stage[];
  configured: boolean;
  error?: string;
};

export type MovePreview = {
  people: BoardPerson[];
  orderedIds: string[];
};

export type FollowUpItem = {
  person: BoardPerson;
  daysQuiet: number;
  latestActivity: {
    label: string;
    value: string;
  };
  ownerLabel: string;
  stageLabel: string;
  followUpDueAt: string;
  missedAt: string;
};

export type AssignmentNotificationItem = {
  event: PersonEvent;
  person: BoardPerson;
  assignedProfile: BoardProfile;
  actorProfile: BoardProfile | null;
};

export type StackExpandedState = Partial<Record<StageId, boolean>>;
