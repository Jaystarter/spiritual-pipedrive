"use client";

import { useState } from "react";
import { closestCorners, DndContext, DragOverlay } from "@dnd-kit/core";

import { ProfileSheet } from "@/components/profiles/profile-sheet";
import { LoginReminder } from "@/components/notifications/login-reminder";
import { AttentionDrawer } from "@/components/notifications/attention-drawer";
import { FirstContactTour } from "@/components/onboarding/first-contact-tour";
import { RegionGate } from "@/components/onboarding/region-gate";
import { Toaster } from "@/components/ui/sonner";
import { setBoardView } from "@/lib/board-view-client";
import { clearActiveRegionId } from "@/lib/region-client";

import type { BoardProps } from "./types";
import { useBoardState } from "./hooks/use-board-state";
import { useBoardDnd } from "./hooks/use-board-dnd";
import { BoardProvider } from "./board-context";
import { Masthead } from "./header/masthead";
import { LedgerStrip } from "./header/ledger-strip";
import { ShellBanners } from "./header/banners";
import { PipelineBoard } from "./views/pipeline-board";
import { StackBoard } from "./views/stack-board";
import { CardDragPreview } from "./cards/card-preview";
import { PersonDetailSheet } from "./detail/person-detail-sheet";
import { QuickAddDialog } from "./dialogs/quick-add-dialog";
import { EditStagesDialog } from "./dialogs/edit-stages-dialog";
import { AlmanacDialog } from "./graphs/almanac-dialog";
import { BottomBar } from "./mobile/bottom-bar";
import { CelebrationLayer } from "./primitives/celebration-layer";

export function BibleStudyBoard(props: BoardProps) {
  const { configured } = props;
  const {
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
    regions,
    activeRegion,
    boardView,
    isPending,
    notice,
    setNotice,
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
  } = useBoardState(props);
  const {
    sensors,
    activePerson,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useBoardDnd({ people, visibleStageIds, setPeople, setNotice, persistMove });
  const [graphsOpen, setGraphsOpen] = useState(false);
  const [editStagesOpen, setEditStagesOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);

  if (!mounted) {
    return <main className="relative min-h-screen overflow-hidden bg-canvas text-ink" />;
  }

  // Onboarding step one: no region chosen yet, so the welcome gate owns the
  // screen. Once a region is picked the page reloads with scoped data and the
  // required profile picker becomes step two.
  if (configured && !activeRegion) {
    return <RegionGate regions={regions} />;
  }

  return (
    <BoardProvider
      data={{
        people,
        filteredPeople,
        profiles,
        activeProfile,
        activeProfileId,
        regions,
        activeRegion,
        stages,
        visibleStages,
        visibleStageIds,
        configured,
        isPending,
        celebratePersonId,
      }}
      actions={{
        onMove: moveWithButtons,
        onSelect: setSelectedId,
        onNotice: setNotice,
        onCreated: handleCreated,
        onUpdated: handleUpdated,
        onDeleted: handleDeleted,
        onStudyLogged: handleStudyLogged,
        onStudyRenamed: handleStudyRenamed,
        onStudyDeleted: handleStudyDeleted,
        onReactionLogged: handleReactionLogged,
        onAcknowledged: handleAcknowledged,
        onProfilesChange: setProfiles,
        requireActiveProfile,
        openQuickAdd: () => setQuickAddOpen(true),
        openProfiles: () => setProfileSheetOpen(true),
      }}
    >
      <main className="relative min-h-screen overflow-hidden bg-canvas text-ink">
        <Masthead
          people={people}
          stages={visibleStages}
          profiles={profiles}
          activeProfile={activeProfile}
          configured={configured}
          notificationCount={
            activeProfileFollowUpItems.length + assignmentNotificationItems.length
          }
          boardView={boardView}
          profileFilter={profileFilter}
          activeRegionName={activeRegion?.name ?? null}
          onSwitchRegion={clearActiveRegionId}
          onProfileFilterChange={setProfileFilter}
          onBoardViewChange={setBoardView}
          onSelectProfile={handleSelectProfile}
          onOpenProfiles={() => setProfileSheetOpen(true)}
          onSelectContact={setSelectedId}
          onAddContact={() => setQuickAddOpen(true)}
          onOpenGraphs={() => setGraphsOpen(true)}
          onOpenStages={() => setEditStagesOpen(true)}
          onOpenNotifications={() => setAttentionOpen(true)}
        />
        <ShellBanners
          configured={configured}
          notice={notice}
          onDismissNotice={() => setNotice(undefined)}
        />
        <LoginReminder
          activeProfileId={activeProfileId}
          activeProfileName={activeProfile?.name ?? null}
          items={activeProfileFollowUpItems}
          onOpenNotifications={() => setAttentionOpen(true)}
        />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1840px] flex-col gap-6 px-4 pb-28 pt-6 sm:px-6 sm:pb-10">
          <LedgerStrip
            people={people}
            activeProfile={activeProfile}
            attentionCount={activeProfileFollowUpItems.length}
            onOpenGraphs={() => setGraphsOpen(true)}
            onOpenNotifications={() => setAttentionOpen(true)}
          />

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {boardView === "pipeline" ? (
              <PipelineBoard people={filteredPeople} stages={visibleStages} />
            ) : (
              <StackBoard people={filteredPeople} stages={visibleStages} />
            )}

            <DragOverlay>
              {boardView === "pipeline" && activePerson ? (
                <CardDragPreview person={activePerson} stages={visibleStages} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        <BottomBar
          activeProfile={activeProfile}
          attentionCount={
            activeProfileFollowUpItems.length + assignmentNotificationItems.length
          }
          boardView={boardView}
          onBoardViewChange={setBoardView}
          onAddContact={() => setQuickAddOpen(true)}
          onOpenAttention={() => setAttentionOpen(true)}
          onOpenGraphs={() => setGraphsOpen(true)}
          onOpenStages={() => setEditStagesOpen(true)}
          onOpenProfiles={() => setProfileSheetOpen(true)}
        />

        {selectedPerson ? (
          <PersonDetailSheet key={selectedPerson.id} person={selectedPerson} />
        ) : null}
        <QuickAddDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
        <ProfileSheet
          open={profileSheetOpen || requireProfile}
          required={requireProfile}
          profiles={profiles}
          activeProfileId={activeProfileId}
          regionId={activeRegion?.id ?? null}
          onClose={() => setProfileSheetOpen(false)}
          onProfilesChange={setProfiles}
          onSelectProfile={handleSelectProfile}
        />
        <AttentionDrawer
          open={attentionOpen}
          activeProfileId={activeProfileId}
          followUpItems={activeProfileFollowUpItems}
          assignmentItems={assignmentNotificationItems}
          onClose={() => setAttentionOpen(false)}
          onSelectPerson={setSelectedId}
        />
        <AlmanacDialog
          open={graphsOpen}
          people={filteredPeople}
          profiles={profiles}
          stages={visibleStages}
          onClose={() => setGraphsOpen(false)}
        />
        <EditStagesDialog
          open={editStagesOpen}
          stages={stages}
          people={people}
          configured={configured}
          onClose={() => setEditStagesOpen(false)}
          onSaved={setStages}
        />
        <CelebrationLayer />
        <FirstContactTour />
        <Toaster />
      </main>
    </BoardProvider>
  );
}
