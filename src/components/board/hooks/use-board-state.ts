"use client";

// The board's state engine: people/profiles/stages state, derived data, and
// every optimistic mutation handler. Handler bodies are moved VERBATIM from
// the original BibleStudyBoard root — the optimistic previews here must stay
// in lockstep with the server rules in src/app/actions.ts.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import {
  movePerson,
  type BoardPerson,
  type PersonEvent,
  type PersonStudy,
} from "@/app/actions";
import {
  getBoardView,
  getBoardViewServerSnapshot,
  onBoardViewChange,
} from "@/lib/board-view-client";
import {
  getActiveProfileId,
  getActiveProfileServerSnapshot,
  onActiveProfileChange,
  setActiveProfileId,
} from "@/lib/profiles-client";
import { getVisibleStages, normalizeStages, type StageId } from "@/lib/stages";

import type { BoardProps } from "../types";
import { celebrate } from "../lib/celebrate";
import {
  filterPeopleForProfile,
  getAssignmentNotificationItems,
  getFollowUpItems,
  matchesContactName,
  normalizeContactSearch,
  sortEventsByNewest,
} from "../lib/derive";
import {
  buildMovePreview,
  getClientAutomaticStudyStage,
  getNextSortOrderForStage,
  isBaptizedLane,
  sortPeople,
} from "../lib/move-preview";
import { sortStudies } from "../lib/studies";

export function useBoardState({
  initialPeople,
  initialProfiles,
  initialStages,
  configured,
  error,
}: BoardProps) {
  const [mounted, setMounted] = useState(false);
  const [people, setPeople] = useState(initialPeople);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [stages, setStages] = useState(() => normalizeStages(initialStages));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState(error);
  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState("all");
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [celebratePersonId, setCelebratePersonId] = useState<string | null>(null);
  const celebrateTimeoutRef = useRef<number | null>(null);
  const activeProfileId = useSyncExternalStore(
    onActiveProfileChange,
    getActiveProfileId,
    getActiveProfileServerSnapshot
  );
  const boardView = useSyncExternalStore(
    onBoardViewChange,
    getBoardView,
    getBoardViewServerSnapshot
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const filteredPeople = useMemo(() => {
    const query = normalizeContactSearch(search);
    const profileFilteredPeople = filterPeopleForProfile(
      people,
      profileFilter,
      activeProfileId
    );

    if (!query) {
      return profileFilteredPeople;
    }

    return profileFilteredPeople.filter((person) => matchesContactName(person, query));
  }, [activeProfileId, people, profileFilter, search]);

  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? null;
  const visibleStages = useMemo(() => getVisibleStages(stages), [stages]);
  const visibleStageIds = useMemo(
    () => new Set(visibleStages.map((stage) => stage.id)),
    [visibleStages]
  );
  const requireProfile = configured && !activeProfile;
  const selectedPerson = selectedId
    ? people.find((person) => person.id === selectedId) ?? null
    : null;
  const assignmentNotificationItems = useMemo(
    () => getAssignmentNotificationItems(people, profiles, activeProfile),
    [activeProfile, people, profiles]
  );
  // Overdue follow-ups scoped strictly to the contacts the active profile
  // entered (created_by_profile_id) — independent of the board's profile filter
  // and of who the contact is later assigned to. Reuses the shared overdue rule.
  const activeProfileFollowUpItems = useMemo(() => {
    if (!activeProfile) {
      return [];
    }

    const ownPeople = people.filter(
      (person) => person.created_by_profile_id === activeProfile.id
    );

    return getFollowUpItems(ownPeople, profiles, visibleStages);
  }, [activeProfile, people, profiles, visibleStages]);

  function requireActiveProfile() {
    if (!activeProfile) {
      setProfileSheetOpen(true);
      setNotice("Choose your profile before making changes.");
      return null;
    }

    return activeProfile.id;
  }

  function handleSelectProfile(profileId: string) {
    setActiveProfileId(profileId);
    setProfileSheetOpen(false);
    setNotice(undefined);
  }

  function persistMove(personId: string, stage: StageId, orderedIds: string[]) {
    const actorProfileId = requireActiveProfile();

    if (!actorProfileId) {
      return;
    }

    // The baptism moment: a one-time celebratory ring on the moved card.
    if (isBaptizedLane(stage)) {
      if (celebrateTimeoutRef.current !== null) {
        window.clearTimeout(celebrateTimeoutRef.current);
      }

      setCelebratePersonId(personId);
      celebrate({
        intensity: "grand",
        colors: [
          "var(--sd-accent-hi)",
          "var(--sd-accent)",
          "var(--tone-green-core)",
        ],
      });
      celebrateTimeoutRef.current = window.setTimeout(() => {
        setCelebratePersonId(null);
        celebrateTimeoutRef.current = null;
      }, 1200);
    }

    startTransition(async () => {
      const result = await movePerson({ id: personId, stage, orderedIds, actorProfileId });

      if (!result.ok) {
        setNotice(result.error);
      }
    });
  }

  function moveWithButtons(person: BoardPerson, stage: StageId) {
    const targetIndex = people.filter((item) => item.stage === stage).length;
    const preview = buildMovePreview(people, person.id, stage, targetIndex);

    if (!preview) {
      return;
    }

    setNotice(undefined);
    setPeople(preview.people);
    persistMove(person.id, stage, preview.orderedIds);
  }

  function handleCreated(person: BoardPerson) {
    setPeople((current) => sortPeople([...current, person]));
    setSelectedId(person.id);
  }

  function handleUpdated(person: BoardPerson) {
    setPeople((current) =>
      current.map((item) =>
        item.id === person.id
          ? {
              ...person,
              events:
                person.events.length > 0
                  ? sortEventsByNewest([
                      ...person.events,
                      ...item.events.filter(
                        (event) =>
                          !person.events.some((incomingEvent) => incomingEvent.id === event.id)
                      ),
                    ])
                  : item.events,
              studies: item.studies,
            }
          : item
      )
    );
  }

  function handleDeleted(personId: string) {
    const deletedPerson = people.find((person) => person.id === personId);

    setPeople((current) => current.filter((person) => person.id !== personId));
    setSelectedId((current) => (current === personId ? null : current));

    if (deletedPerson) {
      setProfiles((current) =>
        current.map((profile) =>
          deletedPerson.assigned_profile_ids.includes(profile.id)
            ? {
                ...profile,
                active_contacts: Math.max(0, profile.active_contacts - 1),
              }
            : profile
        )
      );
    }
  }

  function handleStudyLogged(
    personId: string,
    study: PersonStudy,
    event: PersonEvent
  ) {
    setPeople((current) => {
      return current.map((person) => {
        if (person.id !== personId) {
          return person;
        }

        const nextStudies = sortStudies([
          ...person.studies.filter(
            (item) => item.study_number !== study.study_number
          ),
          study,
        ]);
        const nextStage = getClientAutomaticStudyStage(
          person,
          nextStudies.length,
          visibleStageIds
        );
        const stageChanged = nextStage !== person.stage;

        return {
          ...person,
          stage: nextStage,
          sort_order: stageChanged
            ? getNextSortOrderForStage(current, person.id, nextStage)
            : person.sort_order,
          baptized_at: stageChanged ? null : person.baptized_at,
          studies: nextStudies,
          events: [event, ...person.events],
        };
      });
    });
  }

  function handleStudyRenamed(personId: string, study: PersonStudy) {
    setPeople((current) =>
      current.map((person) =>
        person.id === personId
          ? {
              ...person,
              studies: sortStudies(
                person.studies.map((item) => (item.id === study.id ? study : item))
              ),
            }
          : person
      )
    );
  }

  function handleStudyDeleted(personId: string, studyId: string) {
    setPeople((current) => {
      return current.map((person) => {
        if (person.id !== personId) {
          return person;
        }

        const nextStudies = person.studies.filter((study) => study.id !== studyId);
        const nextStage = getClientAutomaticStudyStage(
          person,
          nextStudies.length,
          visibleStageIds
        );
        const stageChanged = nextStage !== person.stage;

        return {
          ...person,
          stage: nextStage,
          sort_order: stageChanged
            ? getNextSortOrderForStage(current, person.id, nextStage)
            : person.sort_order,
          baptized_at: stageChanged ? null : person.baptized_at,
          studies: nextStudies,
        };
      });
    });
  }

  /**
   * Acknowledgement patches only the follow-up window. `last_contacted_at` is
   * left untouched on purpose so the day counter keeps telling the truth.
   */
  function handleAcknowledged(
    personId: string,
    event: PersonEvent | null,
    nextFollowUpAt: string | null
  ) {
    setPeople((current) =>
      current.map((person) =>
        person.id === personId
          ? {
              ...person,
              next_follow_up_at: nextFollowUpAt,
              events: event ? [event, ...person.events] : person.events,
            }
          : person
      )
    );
  }

  function handleReactionLogged(personId: string, event: PersonEvent) {
    setPeople((current) =>
      current.map((person) =>
        person.id === personId
          ? {
              ...person,
              last_contacted_at: event.created_at,
              events: [event, ...person.events],
            }
          : person
      )
    );
  }

  return {
    mounted,
    celebratePersonId,
    people,
    setPeople,
    filteredPeople,
    profiles,
    setProfiles,
    stages,
    setStages,
    visibleStages,
    visibleStageIds,
    activeProfile,
    activeProfileId,
    boardView,
    isPending,
    notice,
    setNotice,
    search,
    setSearch,
    profileFilter,
    setProfileFilter,
    profileSheetOpen,
    setProfileSheetOpen,
    quickAddOpen,
    setQuickAddOpen,
    selectedPerson,
    setSelectedId,
    requireProfile,
    assignmentNotificationItems,
    activeProfileFollowUpItems,
    requireActiveProfile,
    handleSelectProfile,
    persistMove,
    moveWithButtons,
    handleCreated,
    handleUpdated,
    handleDeleted,
    handleStudyLogged,
    handleStudyRenamed,
    handleStudyDeleted,
    handleReactionLogged,
    handleAcknowledged,
  };
}

export type BoardState = ReturnType<typeof useBoardState>;
