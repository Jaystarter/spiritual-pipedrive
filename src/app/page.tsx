import { cookies } from "next/headers";

import { listPeople } from "@/app/actions";
import { BibleStudyBoard } from "@/components/board/board";
import { REGION_COOKIE_NAME } from "@/lib/region-cookie";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const regionId = cookieStore.get(REGION_COOKIE_NAME)?.value ?? null;
  const board = await listPeople(regionId);

  return (
    <BibleStudyBoard
      initialPeople={board.people}
      initialProfiles={board.profiles}
      initialRegions={board.regions}
      initialStages={board.stages}
      configured={board.configured}
      error={board.error}
    />
  );
}
