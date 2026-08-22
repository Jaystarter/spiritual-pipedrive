"use client";

// Two contexts split by volatility so leaf components can subscribe to only
// what they need:
//  - BoardDataContext: ambient data that changes often (people, stages, …).
//  - BoardActionsContext: a referentially-STABLE object of callbacks — leaf
//    components that only fire actions never re-render on data changes.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import type {
  BoardPerson,
  BoardProfile,
  PersonEvent,
  PersonStudy,
} from "@/app/actions";
import type { Stage, StageId } from "@/lib/stages";

export type BoardData = {
  people: BoardPerson[];
  filteredPeople: BoardPerson[];
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  activeProfileId: string;
  stages: Stage[];
  visibleStages: Stage[];
  visibleStageIds: Set<StageId>;
  configured: boolean;
  isPending: boolean;
  celebratePersonId: string | null;
};

export type BoardActions = {
  onMove: (person: BoardPerson, stage: StageId) => void;
  onSelect: (personId: string | null) => void;
  onNotice: (notice: string | undefined) => void;
  onCreated: (person: BoardPerson) => void;
  onUpdated: (person: BoardPerson) => void;
  onDeleted: (personId: string) => void;
  onStudyLogged: (personId: string, study: PersonStudy, event: PersonEvent) => void;
  onStudyRenamed: (personId: string, study: PersonStudy) => void;
  onStudyDeleted: (personId: string, studyId: string) => void;
  onReactionLogged: (personId: string, event: PersonEvent) => void;
  onAcknowledged: (
    personId: string,
    event: PersonEvent | null,
    nextFollowUpAt: string | null
  ) => void;
  onProfilesChange: (
    profiles: BoardProfile[] | ((current: BoardProfile[]) => BoardProfile[])
  ) => void;
  requireActiveProfile: () => string | null;
  openQuickAdd: () => void;
  openProfiles: () => void;
};

const BoardDataContext = createContext<BoardData | null>(null);
const BoardActionsContext = createContext<BoardActions | null>(null);

export function BoardProvider({
  data,
  actions,
  children,
}: {
  data: BoardData;
  actions: BoardActions;
  children: ReactNode;
}) {
  // Pin the actions object: consumers get one stable reference whose methods
  // always delegate to the latest handlers. The ref is synced in an effect
  // (not during render); action callbacks only fire from user events, which
  // always happen after the sync.
  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  });

  const stableActions = useMemo<BoardActions>(
    () => ({
      onMove: (...args) => actionsRef.current.onMove(...args),
      onSelect: (...args) => actionsRef.current.onSelect(...args),
      onNotice: (...args) => actionsRef.current.onNotice(...args),
      onCreated: (...args) => actionsRef.current.onCreated(...args),
      onUpdated: (...args) => actionsRef.current.onUpdated(...args),
      onDeleted: (...args) => actionsRef.current.onDeleted(...args),
      onStudyLogged: (...args) => actionsRef.current.onStudyLogged(...args),
      onStudyRenamed: (...args) => actionsRef.current.onStudyRenamed(...args),
      onStudyDeleted: (...args) => actionsRef.current.onStudyDeleted(...args),
      onReactionLogged: (...args) => actionsRef.current.onReactionLogged(...args),
      onAcknowledged: (...args) => actionsRef.current.onAcknowledged(...args),
      onProfilesChange: (...args) => actionsRef.current.onProfilesChange(...args),
      requireActiveProfile: () => actionsRef.current.requireActiveProfile(),
      openQuickAdd: () => actionsRef.current.openQuickAdd(),
      openProfiles: () => actionsRef.current.openProfiles(),
    }),
    []
  );

  return (
    <BoardActionsContext.Provider value={stableActions}>
      <BoardDataContext.Provider value={data}>
        {children}
      </BoardDataContext.Provider>
    </BoardActionsContext.Provider>
  );
}

export function useBoardData() {
  const context = useContext(BoardDataContext);

  if (!context) {
    throw new Error("useBoardData must be used inside <BoardProvider>.");
  }

  return context;
}

export function useBoardActions() {
  const context = useContext(BoardActionsContext);

  if (!context) {
    throw new Error("useBoardActions must be used inside <BoardProvider>.");
  }

  return context;
}
