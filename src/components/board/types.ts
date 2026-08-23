import type {
  BoardPerson,
  BoardProfile,
  BoardRegion,
  PersonEvent,
} from "@/app/actions";
import type { Stage, StageId } from "@/lib/stages";

export type BoardProps = {
  initialPeople: BoardPerson[];
  initialProfiles: BoardProfile[];
  initialRegions: BoardRegion[];
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
  /** Days since real activity. Keeps climbing even while acknowledged. */
  daysQuiet: number;
  /** Quiet past the threshold and not acknowledged, so still waiting on you. */
  isOverdue: boolean;
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
