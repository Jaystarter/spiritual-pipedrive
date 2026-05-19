import { listPeople } from "@/app/actions";
import { BibleStudyBoard } from "@/components/board/board";

export const dynamic = "force-dynamic";

export default async function Home() {
  const board = await listPeople();

  return (
    <BibleStudyBoard
      initialPeople={board.people}
      initialProfiles={board.profiles}
      initialStages={board.stages}
      configured={board.configured}
      error={board.error}
    />
  );
}
