"use server";

import { revalidatePath } from "next/cache";

import {
  DEFAULT_STAGES,
  cleanStageDescription,
  cleanStageLabel,
  cleanStageShortLabel,
  getAutomaticStudyStageId,
  getFallbackTone,
  getStageLabel,
  getVisibleStages,
  isManualOnlyStage,
  isStageId,
  isStageToneName,
  normalizeStages,
  type Stage,
  type StageId,
} from "@/lib/stages";
import { createSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type PersonRow = Database["public"]["Tables"]["people"]["Row"];
type PersonInsert = Database["public"]["Tables"]["people"]["Insert"];
type PersonUpdate = Database["public"]["Tables"]["people"]["Update"];
type EventInsert = Database["public"]["Tables"]["person_events"]["Insert"];
type StudyInsert = Database["public"]["Tables"]["person_studies"]["Insert"];
type StudyUpdate = Database["public"]["Tables"]["person_studies"]["Update"];
type StageRow = Database["public"]["Tables"]["stages"]["Row"];
type StageInsert = Database["public"]["Tables"]["stages"]["Insert"];

export type PersonEvent = Database["public"]["Tables"]["person_events"]["Row"];
export type PersonStudy = Database["public"]["Tables"]["person_studies"]["Row"];
export type BoardProfile = Database["public"]["Tables"]["profiles"]["Row"] & {
  active_contacts: number;
  baptized_this_month: number;
};
export type BoardPerson = PersonRow & {
  events: PersonEvent[];
  studies: PersonStudy[];
};
export type PersonLifeStatus = NonNullable<PersonRow["life_status"]>;

export type BoardState = {
  people: BoardPerson[];
  profiles: BoardProfile[];
  stages: Stage[];
  configured: boolean;
  error?: string;
};

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

type PersonInput = {
  name: string;
  stage: StageId;
  phone?: string;
  notes?: string;
  nextFollowUpAt?: string;
  assignedProfileIds: string[];
  actorProfileId: string;
};

type UpdatePersonInput = Partial<Omit<PersonInput, "stage" | "actorProfileId">> & {
  id: string;
  stage?: StageId;
  lifeStatus?: PersonLifeStatus | null;
  lastContactedAt?: string;
  actorProfileId: string;
};

type MovePersonInput = {
  id: string;
  stage: StageId;
  orderedIds: string[];
  actorProfileId: string;
};

type SaveStagesInput = {
  stages: Stage[];
};

type AddNoteInput = {
  id: string;
  body: string;
  nextFollowUpAt?: string;
  markContacted?: boolean;
  actorProfileId: string;
};

type AddPersonStudyInput = {
  id: string;
  studyNumber: number;
  title?: string;
  studiedAt: string;
  notes?: string;
  actorProfileId: string;
};

type UpdatePersonStudyTitleInput = {
  id: string;
  title: string;
  actorProfileId: string;
};

type UpdatePersonStudyNoteInput = {
  id: string;
  notes: string;
  actorProfileId: string;
};

type DeletePersonStudyInput = {
  id: string;
  actorProfileId: string;
};

export type ContactReactionChannel = "text" | "call";
export type ContactReactionOutcome =
  | "responded"
  | "no_response"
  | "picked_up"
  | "missed";

type AddContactReactionInput = {
  id: string;
  channel: ContactReactionChannel;
  outcome: ContactReactionOutcome;
  actorProfileId: string;
};

type AddPersonStudyResult = {
  study: PersonStudy;
  event: PersonEvent;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PERSON_STUDIES = 68;

function cleanOptional(value?: string) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function cleanStudyTitle(value: string | undefined, studyNumber: number) {
  const cleaned = value?.trim() || `Study ${studyNumber}`;
  return cleaned.slice(0, 80);
}

function cleanDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function cleanDateOnly(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return value;
}

function cleanProfileName(value: string) {
  const name = value.trim();

  if (!name) {
    return null;
  }

  return name.slice(0, 30);
}

function cleanAvatarUrl(value?: string | null) {
  const avatarUrl = value?.trim();

  if (!avatarUrl) {
    return null;
  }

  if (avatarUrl.length > 100000) {
    throw new Error("Photo is too large.");
  }

  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(avatarUrl)) {
    throw new Error("Photo must be a PNG, JPEG, or WebP image.");
  }

  return avatarUrl;
}

function cleanLifeStatus(value: PersonLifeStatus | null) {
  if (value === null || value === "student" || value === "worker") {
    return value;
  }

  return undefined;
}

function mapStageRow(stage: StageRow): Stage {
  return {
    id: stage.id,
    label: stage.label,
    shortLabel: stage.short_label,
    description: stage.description,
    tone: stage.tone,
    sortOrder: stage.sort_order,
    isHidden: stage.is_hidden,
    isSystem: stage.is_system,
  };
}

async function listStages() {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return DEFAULT_STAGES;
  }

  const { data, error } = await supabase
    .from("stages")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error || !data || data.length === 0) {
    return DEFAULT_STAGES;
  }

  return normalizeStages(data.map(mapStageRow));
}

async function validateVisibleStage(stageId: StageId) {
  if (!isStageId(stageId)) {
    return { error: "Choose a valid stage." } as const;
  }

  const stages = await listStages();
  const stage = getVisibleStages(stages).find((item) => item.id === stageId);

  if (!stage) {
    return { error: "Choose a visible stack." } as const;
  }

  return { stage, stages } as const;
}

function currentMonthWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return { start, end };
}

function isCurrentMonth(value: string | null) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const { start, end } = currentMonthWindow();

  return date >= start && date < end;
}

function normalizeProfileIds(
  value: string[] | undefined
): { ids: string[] } | { error: string } {
  const ids = Array.from(new Set((value ?? []).map((id) => id.trim()).filter(Boolean)));

  if (ids.length < 1 || ids.length > 3) {
    return { error: "Choose between 1 and 3 profiles." };
  }

  if (ids.some((id) => !uuidPattern.test(id))) {
    return { error: "Choose registered profiles only." };
  }

  return { ids };
}

function normalizeActorProfileId(value: string | undefined) {
  const id = value?.trim();

  if (!id || !uuidPattern.test(id)) {
    return null;
  }

  return id;
}

async function getProfilesByIds(ids: string[]) {
  const supabase = createSupabaseAdmin();

  if (!supabase || ids.length === 0) {
    return [];
  }

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);

  return data ?? [];
}

async function validateProfiles(
  ids: string[]
): Promise<
  | { profiles: Database["public"]["Tables"]["profiles"]["Row"][] }
  | { error: string }
> {
  const profiles = await getProfilesByIds(ids);

  if (profiles.length !== ids.length) {
    return { error: "One or more selected profiles no longer exist." };
  }

  return { profiles };
}

async function validateActorProfile(
  id: string | undefined
): Promise<{ actorProfileId: string } | { error: string }> {
  const actorProfileId = normalizeActorProfileId(id);

  if (!actorProfileId) {
    return { error: "Choose your profile before making changes." };
  }

  const result = await validateProfiles([actorProfileId]);

  if ("error" in result) {
    return { error: "Choose a valid active profile before making changes." };
  }

  return { actorProfileId };
}

function assignedTeacherLabel(profiles: Database["public"]["Tables"]["profiles"]["Row"][]) {
  return profiles.map((profile) => profile.name).join(", ");
}

async function getNextSortOrder(stage: StageId) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return 1000;
  }

  const { data } = await supabase
    .from("people")
    .select("sort_order")
    .eq("stage", stage)
    .is("archived_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.sort_order ?? 0) + 1000;
}

function getVisibleAutomaticStudyStageId(studyCount: number, stages: Stage[]) {
  const targetStage = getAutomaticStudyStageId(studyCount);

  return getVisibleStages(stages).some((stage) => stage.id === targetStage)
    ? targetStage
    : null;
}

function applyAutomaticStudyStage(
  person: BoardPerson,
  stages: Stage[]
): BoardPerson {
  if (isManualOnlyStage(person.stage)) {
    return person;
  }

  const targetStage = getVisibleAutomaticStudyStageId(person.studies.length, stages);

  if (!targetStage || targetStage === person.stage) {
    return person;
  }

  return {
    ...person,
    stage: targetStage,
    baptized_at: null,
  };
}

async function countPersonStudies(personId: string) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return 0;
  }

  const { data, error } = await supabase
    .from("person_studies")
    .select("id")
    .eq("person_id", personId);

  if (error) {
    throw new Error(error.message);
  }

  return data?.length ?? 0;
}

async function synchronizeAutomaticStudyStage(
  personId: string,
  studyCount: number,
  actorProfileId: string
) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return null;
  }

  const stages = await listStages();
  const targetStage = getVisibleAutomaticStudyStageId(studyCount, stages);

  if (!targetStage) {
    return null;
  }

  const { data: currentPerson, error: currentError } = await supabase
    .from("people")
    .select("stage")
    .eq("id", personId)
    .is("archived_at", null)
    .maybeSingle();

  if (currentError || !currentPerson || isManualOnlyStage(currentPerson.stage)) {
    return null;
  }

  const fromStage = currentPerson.stage;

  if (fromStage === targetStage) {
    return targetStage;
  }

  const { error: updateError } = await supabase
    .from("people")
    .update({
      stage: targetStage,
      sort_order: await getNextSortOrder(targetStage),
      baptized_at: null,
    })
    .eq("id", personId)
    .is("archived_at", null);

  if (updateError) {
    return null;
  }

  await insertEvent(personId, {
    event_type: "stage_moved",
    title: `Moved to ${getStageLabel(targetStage, stages)}`,
    body: `Automatically moved after ${studyCount} completed ${
      studyCount === 1 ? "study" : "studies"
    }.`,
    from_stage: fromStage,
    to_stage: targetStage,
    actor_profile_id: actorProfileId,
  });

  return targetStage;
}

async function insertEvent(
  personId: string,
  event: Omit<EventInsert, "person_id">
): Promise<PersonEvent | null> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("person_events")
    .insert({
      person_id: personId,
      ...event,
    })
    .select("*")
    .single();

  return data ?? null;
}

async function hydratePeople(people: PersonRow[]) {
  if (people.length === 0) {
    return [] as BoardPerson[];
  }

  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return people.map((person) => ({ ...person, events: [], studies: [] }));
  }

  const ids = people.map((person) => person.id);
  const [{ data: events }, { data: studies }] = await Promise.all([
    supabase
    .from("person_events")
    .select("*")
    .in("person_id", ids)
    .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("person_studies")
      .select("*")
      .in("person_id", ids)
      .order("study_number", { ascending: true }),
  ]);
  const eventsByPerson = new Map<string, PersonEvent[]>();
  const studiesByPerson = new Map<string, PersonStudy[]>();

  for (const event of events ?? []) {
    const events = eventsByPerson.get(event.person_id) ?? [];
    events.push(event);
    eventsByPerson.set(event.person_id, events);
  }

  for (const study of studies ?? []) {
    const personStudies = studiesByPerson.get(study.person_id) ?? [];
    personStudies.push(study);
    studiesByPerson.set(study.person_id, personStudies);
  }

  return people.map((person) => ({
    ...person,
    events: eventsByPerson.get(person.id) ?? [],
    studies: studiesByPerson.get(person.id) ?? [],
  }));
}

async function listProfilesWithStats(people?: PersonRow[]) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return [] as BoardProfile[];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const activePeople =
    people ??
    (
      await supabase
        .from("people")
        .select("*")
        .is("archived_at", null)
    ).data ??
    [];

  return (data ?? [])
    .map((profile) => ({
      ...profile,
      active_contacts: activePeople.filter((person) =>
        person.assigned_profile_ids.includes(profile.id)
      ).length,
      baptized_this_month: activePeople.filter(
        (person) =>
          person.stage === "baptized" &&
          isCurrentMonth(person.baptized_at) &&
          person.assigned_profile_ids.includes(profile.id)
      ).length,
    }))
    .sort((a, b) => {
      if (b.active_contacts !== a.active_contacts) {
        return b.active_contacts - a.active_contacts;
      }

      return a.name.localeCompare(b.name);
    });
}

export async function listPeople(): Promise<BoardState> {
  const stages = await listStages();

  if (!isSupabaseConfigured()) {
    return {
      people: [],
      profiles: [],
      stages,
      configured: false,
      error:
        "Supabase is not configured yet. Add SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel.",
    };
  }

  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return {
      people: [],
      profiles: [],
      stages,
      configured: false,
      error: "Supabase credentials are missing.",
    };
  }

  const { data, error } = await supabase
    .from("people")
    .select("*")
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return {
      people: [],
      profiles: [],
      stages,
      configured: true,
      error: error.message,
    };
  }

  const people = (data ?? []).filter(
    (person) => person.stage !== "baptized" || isCurrentMonth(person.baptized_at)
  );

  const hydratedPeople = (await hydratePeople(people)).map((person) =>
    applyAutomaticStudyStage(person, stages)
  );

  try {
    return {
      people: hydratedPeople,
      profiles: await listProfilesWithStats(hydratedPeople),
      stages,
      configured: true,
    };
  } catch (profileError) {
    return {
      people: hydratedPeople,
      profiles: [],
      stages,
      configured: true,
      error:
        profileError instanceof Error
          ? profileError.message
          : "Profiles could not be loaded.",
    };
  }
}

export async function createProfile(
  name: string
): Promise<ActionResult<BoardProfile>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const cleanName = cleanProfileName(name);

  if (!cleanName) {
    return { ok: false, error: "Name is required." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({ name: cleanName })
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "That profile already exists." : error.message,
    };
  }

  revalidatePath("/");
  return {
    ok: true,
    data: { ...data, active_contacts: 0, baptized_this_month: 0 },
  };
}

export async function renameProfile(
  id: string,
  name: string
): Promise<ActionResult<BoardProfile>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const profileId = id.trim();

  if (!uuidPattern.test(profileId)) {
    return { ok: false, error: "Choose a valid profile." };
  }

  const cleanName = cleanProfileName(name);

  if (!cleanName) {
    return { ok: false, error: "Name is required." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ name: cleanName })
    .eq("id", profileId)
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "That profile already exists." : error.message,
    };
  }

  const profiles = await listProfilesWithStats();
  const profile = profiles.find((item) => item.id === data.id);

  revalidatePath("/");
  return {
    ok: true,
    data: profile ?? { ...data, active_contacts: 0, baptized_this_month: 0 },
  };
}

export async function updateProfileAvatar(
  id: string,
  avatarUrl: string | null
): Promise<ActionResult<BoardProfile>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_url: cleanAvatarUrl(avatarUrl) })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    const profiles = await listProfilesWithStats();
    const profile = profiles.find((item) => item.id === data.id);

    revalidatePath("/");
    return { ok: true, data: profile ?? { ...data, active_contacts: 0, baptized_this_month: 0 } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update photo.",
    };
  }
}

type AvatarFramingInput = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  if (numeric < min) {
    return min;
  }

  if (numeric > max) {
    return max;
  }

  return numeric;
}

export async function updateProfileAvatarFraming(
  id: string,
  framing: AvatarFramingInput
): Promise<ActionResult<BoardProfile>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const profileId = id.trim();

  if (!uuidPattern.test(profileId)) {
    return { ok: false, error: "Choose a valid profile." };
  }

  const offsetX = clampNumber(framing.offsetX, 0, 100, 50);
  const offsetY = clampNumber(framing.offsetY, 0, 100, 50);
  const scale = clampNumber(framing.scale, 1, 3, 1);

  const { data, error } = await supabase
    .from("profiles")
    .update({
      avatar_offset_x: offsetX,
      avatar_offset_y: offsetY,
      avatar_scale: scale,
    })
    .eq("id", profileId)
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  const profiles = await listProfilesWithStats();
  const profile = profiles.find((item) => item.id === data.id);

  revalidatePath("/");
  return {
    ok: true,
    data: profile ?? { ...data, active_contacts: 0, baptized_this_month: 0 },
  };
}

export async function updatePersonAvatar(
  id: string,
  avatarUrl: string | null,
  actorProfileId: string
): Promise<ActionResult<BoardPerson>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const actor = await validateActorProfile(actorProfileId);

  if ("error" in actor) {
    return { ok: false, error: actor.error };
  }

  try {
    const { data, error } = await supabase
      .from("people")
      .update({ avatar_url: cleanAvatarUrl(avatarUrl) })
      .eq("id", id)
      .is("archived_at", null)
      .select("*")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    await insertEvent(data.id, {
      event_type: "details_updated",
      title: "Contact photo updated",
      body: avatarUrl ? "Added or changed the contact photo." : "Removed the contact photo.",
      actor_profile_id: actor.actorProfileId,
    });

    revalidatePath("/");
    return { ok: true, data: { ...data, events: [], studies: [] } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update photo.",
    };
  }
}

export async function deleteProfile(id: string): Promise<ActionResult> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const profileId = id.trim();

  if (!uuidPattern.test(profileId)) {
    return { ok: false, error: "Choose a valid profile." };
  }

  const { data: assignedPeople } = await supabase
    .from("people")
    .select("id")
    .is("archived_at", null)
    .contains("assigned_profile_ids", [profileId])
    .limit(1);

  if ((assignedPeople ?? []).length > 0) {
    return {
      ok: false,
      error: "Move this profile's contacts before deleting it.",
    };
  }

  const { error } = await supabase.from("profiles").delete().eq("id", profileId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function saveStages(
  input: SaveStagesInput
): Promise<ActionResult<Stage[]>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("stages")
    .select("*")
    .order("sort_order", { ascending: true });

  if (existingError) {
    return {
      ok: false,
      error: "Run the latest Supabase migration before editing stacks.",
    };
  }

  const existingStages = normalizeStages((existingRows ?? []).map(mapStageRow));
  const existingById = new Map(existingStages.map((stage) => [stage.id, stage]));
  const seen = new Set<string>();
  const nextStages: Stage[] = [];

  for (const [index, stage] of input.stages.entries()) {
    const id = stage.id.trim();

    if (!isStageId(id)) {
      return { ok: false, error: "Stack IDs can use lowercase letters, numbers, dashes, and underscores." };
    }

    if (seen.has(id)) {
      return { ok: false, error: "Each stack needs a unique name." };
    }

    const label = cleanStageLabel(stage.label);

    if (!label) {
      return { ok: false, error: "Each stack needs a label." };
    }

    const existing = existingById.get(id);
    seen.add(id);
    nextStages.push({
      id,
      label,
      shortLabel: cleanStageShortLabel(stage.shortLabel) || label.slice(0, 24),
      description: cleanStageDescription(stage.description),
      tone: isStageToneName(stage.tone) ? stage.tone : getFallbackTone(index + 1),
      sortOrder: (index + 1) * 1000,
      isHidden: Boolean(stage.isHidden),
      isSystem:
        existing?.isSystem ??
        DEFAULT_STAGES.some((defaultStage) => defaultStage.id === id),
    });
  }

  if (!nextStages.some((stage) => !stage.isHidden)) {
    return { ok: false, error: "Keep at least one stack visible." };
  }

  const hiddenIds = nextStages
    .filter((stage) => stage.isHidden)
    .map((stage) => stage.id);

  if (hiddenIds.length > 0) {
    const { data: activePeople, error: activePeopleError } = await supabase
      .from("people")
      .select("stage")
      .in("stage", hiddenIds)
      .is("archived_at", null)
      .limit(1);

    if (activePeopleError) {
      return { ok: false, error: activePeopleError.message };
    }

    const blockedStageId = activePeople?.[0]?.stage;

    if (blockedStageId) {
      return {
        ok: false,
        error: `Move contacts out of ${getStageLabel(blockedStageId, nextStages)} before deleting it.`,
      };
    }
  }

  const rows: StageInsert[] = nextStages.map((stage) => ({
    id: stage.id,
    label: stage.label,
    short_label: stage.shortLabel,
    description: stage.description,
    tone: stage.tone,
    sort_order: stage.sortOrder,
    is_hidden: stage.isHidden,
    is_system: stage.isSystem,
  }));

  const { error: upsertError } = await supabase
    .from("stages")
    .upsert(rows, { onConflict: "id" });

  if (upsertError) {
    return { ok: false, error: upsertError.message };
  }

  const stages = await listStages();

  revalidatePath("/");
  return { ok: true, data: stages };
}

export async function createPerson(
  input: PersonInput
): Promise<ActionResult<BoardPerson>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const actor = await validateActorProfile(input.actorProfileId);

  if ("error" in actor) {
    return { ok: false, error: actor.error };
  }

  const normalizedProfiles = normalizeProfileIds(input.assignedProfileIds);

  if ("error" in normalizedProfiles) {
    return { ok: false, error: normalizedProfiles.error };
  }

  const selectedProfiles = await validateProfiles(normalizedProfiles.ids);

  if ("error" in selectedProfiles) {
    return { ok: false, error: selectedProfiles.error };
  }

  const name = input.name.trim();

  if (!name) {
    return { ok: false, error: "Add a name before creating a card." };
  }

  const stageResult = await validateVisibleStage(input.stage);

  if ("error" in stageResult) {
    return { ok: false, error: stageResult.error ?? "Choose a visible stack." };
  }

  const targetStage = isManualOnlyStage(input.stage)
    ? input.stage
    : getVisibleAutomaticStudyStageId(0, stageResult.stages) ?? input.stage;
  const sortOrder = await getNextSortOrder(targetStage);
  const baptizedAt =
    targetStage === "baptized" ? new Date().toISOString() : null;
  const insert: PersonInsert = {
    name,
    stage: targetStage,
    phone: cleanOptional(input.phone),
    teacher: assignedTeacherLabel(selectedProfiles.profiles),
    notes: cleanOptional(input.notes),
    assigned_profile_ids: normalizedProfiles.ids,
    created_by_profile_id: actor.actorProfileId,
    sort_order: sortOrder,
    baptized_at: baptizedAt,
    next_follow_up_at: cleanDate(input.nextFollowUpAt),
  };

  const { data, error } = await supabase
    .from("people")
    .insert(insert)
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  await insertEvent(data.id, {
    event_type: "created",
    title: "Added to the journey",
    body:
      targetStage === "hunting"
        ? "Started in Sowing Seeds."
        : `Started in ${getStageLabel(targetStage, stageResult.stages)}.`,
    to_stage: targetStage,
    actor_profile_id: actor.actorProfileId,
  });

  revalidatePath("/");
  return { ok: true, data: { ...data, events: [], studies: [] } };
}

export async function updatePerson(
  input: UpdatePersonInput
): Promise<ActionResult<BoardPerson>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const actor = await validateActorProfile(input.actorProfileId);

  if ("error" in actor) {
    return { ok: false, error: actor.error };
  }

  if (input.stage) {
    const stageResult = await validateVisibleStage(input.stage);

    if ("error" in stageResult) {
      return { ok: false, error: stageResult.error ?? "Choose a visible stack." };
    }
  }

  const patch: PersonUpdate = {};
  const assignmentEvents: PersonEvent[] = [];
  let newlyAssignedProfiles: Database["public"]["Tables"]["profiles"]["Row"][] = [];
  let detailsChanged = false;

  if (input.name !== undefined) {
    const name = input.name.trim();

    if (!name) {
      return { ok: false, error: "A card needs a name." };
    }

    patch.name = name;
    detailsChanged = true;
  }

  if (input.stage) {
    patch.stage = input.stage;
    patch.baptized_at =
      input.stage === "baptized" ? new Date().toISOString() : null;
    detailsChanged = true;
  }

  if (input.phone !== undefined) {
    patch.phone = cleanOptional(input.phone);
    detailsChanged = true;
  }

  if (input.notes !== undefined) {
    patch.notes = cleanOptional(input.notes);
    detailsChanged = true;
  }

  if (input.lifeStatus !== undefined) {
    const lifeStatus = cleanLifeStatus(input.lifeStatus);

    if (lifeStatus === undefined) {
      return { ok: false, error: "Choose student, worker, or clear the status." };
    }

    patch.life_status = lifeStatus;
    detailsChanged = true;
  }

  if (input.nextFollowUpAt !== undefined) {
    patch.next_follow_up_at = cleanDate(input.nextFollowUpAt);
    detailsChanged = true;
  }

  if (input.lastContactedAt !== undefined) {
    patch.last_contacted_at = cleanDate(input.lastContactedAt);
    detailsChanged = true;
  }

  if (input.assignedProfileIds !== undefined) {
    const { data: currentPerson, error: currentPersonError } = await supabase
      .from("people")
      .select("assigned_profile_ids")
      .eq("id", input.id)
      .is("archived_at", null)
      .maybeSingle();

    if (currentPersonError) {
      return { ok: false, error: currentPersonError.message };
    }

    if (!currentPerson) {
      return { ok: false, error: "That contact no longer exists." };
    }

    const normalizedProfiles = normalizeProfileIds(input.assignedProfileIds);

    if ("error" in normalizedProfiles) {
      return { ok: false, error: normalizedProfiles.error };
    }

    const selectedProfiles = await validateProfiles(normalizedProfiles.ids);

    if ("error" in selectedProfiles) {
      return { ok: false, error: selectedProfiles.error };
    }

    patch.assigned_profile_ids = normalizedProfiles.ids;
    patch.teacher = assignedTeacherLabel(selectedProfiles.profiles);
    const currentPrimaryProfileId = currentPerson.assigned_profile_ids[0] ?? null;
    const nextPrimaryProfileId = normalizedProfiles.ids[0] ?? null;
    newlyAssignedProfiles = selectedProfiles.profiles.filter(
      (profile) =>
        !currentPerson.assigned_profile_ids.includes(profile.id) ||
        (profile.id === nextPrimaryProfileId && profile.id !== currentPrimaryProfileId)
    );
  }

  const { data, error } = await supabase
    .from("people")
    .update(patch)
    .eq("id", input.id)
    .is("archived_at", null)
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (detailsChanged) {
    const detailEvent = await insertEvent(data.id, {
      event_type: "details_updated",
      title: "Details updated",
      body: "Contact information, notes, or follow-up details changed.",
      actor_profile_id: actor.actorProfileId,
    });

    if (detailEvent) {
      assignmentEvents.push(detailEvent);
    }
  }

  for (const profile of newlyAssignedProfiles) {
    const event = await insertEvent(data.id, {
      event_type: "assigned",
      title: `${profile.name} assigned`,
      body: `${profile.name} was assigned to ${data.name}.`,
      actor_profile_id: actor.actorProfileId,
      notification_profile_id: profile.id,
    });

    if (event) {
      assignmentEvents.push(event);
    }
  }

  revalidatePath("/");
  return { ok: true, data: { ...data, events: assignmentEvents, studies: [] } };
}

export async function movePerson(
  input: MovePersonInput
): Promise<ActionResult> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const actor = await validateActorProfile(input.actorProfileId);

  if ("error" in actor) {
    return { ok: false, error: actor.error };
  }

  const stageResult = await validateVisibleStage(input.stage);

  if ("error" in stageResult) {
    return { ok: false, error: stageResult.error ?? "Choose a visible stack." };
  }

  const orderedIds = Array.from(new Set(input.orderedIds));
  const idsToUpdate = orderedIds.includes(input.id)
    ? orderedIds
    : [input.id, ...orderedIds];

  const { data: currentPerson } = await supabase
    .from("people")
    .select("stage")
    .eq("id", input.id)
    .is("archived_at", null)
    .maybeSingle();
  const fromStage = currentPerson?.stage ?? null;
  const updates = idsToUpdate.map((id, index) => {
    const movedCard = id === input.id;
    const update: PersonUpdate = {
      stage: input.stage,
      sort_order: (index + 1) * 1000,
    };

    if (movedCard) {
      update.baptized_at =
        input.stage === "baptized" ? new Date().toISOString() : null;
    }

    return supabase
      .from("people")
      .update(update)
      .eq("id", id)
      .is("archived_at", null);
  });

  const results = await Promise.all(updates);
  const error = results.find((result) => result.error)?.error;

  if (error) {
    return { ok: false, error: error.message };
  }

  if (fromStage !== input.stage) {
    await insertEvent(input.id, {
      event_type: "stage_moved",
      title: `Moved to ${getStageLabel(input.stage, stageResult.stages)}`,
      body: fromStage
        ? `Moved from ${getStageLabel(fromStage, stageResult.stages)} to ${getStageLabel(input.stage, stageResult.stages)}.`
        : `Moved to ${getStageLabel(input.stage, stageResult.stages)}.`,
      from_stage: fromStage,
      to_stage: input.stage,
      actor_profile_id: actor.actorProfileId,
    });
  }

  revalidatePath("/");
  return { ok: true };
}

export async function archivePerson(
  id: string,
  actorProfileId: string
): Promise<ActionResult> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const actor = await validateActorProfile(actorProfileId);

  if ("error" in actor) {
    return { ok: false, error: actor.error };
  }

  await insertEvent(id, {
    event_type: "archived",
    title: "Archived",
    body: "Removed from the active board.",
    actor_profile_id: actor.actorProfileId,
  });

  const { error } = await supabase
    .from("people")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function deletePerson(
  id: string,
  actorProfileId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const actor = await validateActorProfile(actorProfileId);

  if ("error" in actor) {
    return { ok: false, error: actor.error };
  }

  const personId = id.trim();

  if (!uuidPattern.test(personId)) {
    return { ok: false, error: "Choose a valid contact." };
  }

  const { data, error } = await supabase
    .from("people")
    .delete()
    .eq("id", personId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "That contact no longer exists." };
  }

  revalidatePath("/");
  return { ok: true, data };
}

export async function addPersonNote(
  input: AddNoteInput
): Promise<ActionResult<PersonEvent>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const actor = await validateActorProfile(input.actorProfileId);

  if ("error" in actor) {
    return { ok: false, error: actor.error };
  }

  const body = input.body.trim();

  if (!body) {
    return { ok: false, error: "Write a note before saving." };
  }

  const { data, error } = await supabase
    .from("person_events")
    .insert({
      person_id: input.id,
      event_type: "note_added",
      title: "Note added",
      body,
      actor_profile_id: actor.actorProfileId,
    })
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  const personPatch: PersonUpdate = {};

  if (input.markContacted) {
    personPatch.last_contacted_at = new Date().toISOString();
  }

  if (input.nextFollowUpAt !== undefined) {
    personPatch.next_follow_up_at = cleanDate(input.nextFollowUpAt);
  }

  if (Object.keys(personPatch).length > 0) {
    await supabase
      .from("people")
      .update(personPatch)
      .eq("id", input.id)
      .is("archived_at", null);
  }

  revalidatePath("/");
  return { ok: true, data };
}

export async function addContactReaction(
  input: AddContactReactionInput
): Promise<ActionResult<PersonEvent>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const actor = await validateActorProfile(input.actorProfileId);

  if ("error" in actor) {
    return { ok: false, error: actor.error };
  }

  const outcomes: Record<ContactReactionOutcome, { label: string; body: string }> = {
    responded: {
      label: "Replied",
      body: "Contact replied by text.",
    },
    no_response: {
      label: "No reply",
      body: "Contact has not replied yet.",
    },
    picked_up: {
      label: "Picked up",
      body: "Contact picked up the call.",
    },
    missed: {
      label: "Missed",
      body: "Call was not answered.",
    },
  };
  const validTextOutcome =
    input.channel === "text" &&
    (input.outcome === "responded" || input.outcome === "no_response");
  const validCallOutcome =
    input.channel === "call" && (input.outcome === "picked_up" || input.outcome === "missed");

  if (!validTextOutcome && !validCallOutcome) {
    return { ok: false, error: "Choose a valid contact reaction." };
  }

  const outcome = outcomes[input.outcome];
  const channelLabel = input.channel === "text" ? "Text" : "Call";
  const { data, error } = await supabase
    .from("person_events")
    .insert({
      person_id: input.id,
      event_type: input.channel === "text" ? "text_reaction" : "call_reaction",
      title: `${channelLabel}: ${outcome.label}`,
      body: outcome.body,
      actor_profile_id: actor.actorProfileId,
    })
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase
    .from("people")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("id", input.id)
    .is("archived_at", null);

  revalidatePath("/");
  return { ok: true, data };
}

export async function addPersonStudy(
  input: AddPersonStudyInput
): Promise<ActionResult<AddPersonStudyResult>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const actor = await validateActorProfile(input.actorProfileId);

  if ("error" in actor) {
    return { ok: false, error: actor.error };
  }

  const studyNumber = Math.trunc(input.studyNumber);

  if (studyNumber < 1 || studyNumber > MAX_PERSON_STUDIES) {
    return { ok: false, error: `Choose a study from 1 to ${MAX_PERSON_STUDIES}.` };
  }

  const studiedAt = cleanDateOnly(input.studiedAt);

  if (!studiedAt) {
    return { ok: false, error: "Choose the study date." };
  }

  const notes = cleanOptional(input.notes);
  const studyInsert: StudyInsert = {
    person_id: input.id,
    study_number: studyNumber,
    title: cleanStudyTitle(input.title, studyNumber),
    studied_at: studiedAt,
    notes,
    actor_profile_id: actor.actorProfileId,
  };

  const { data: study, error: studyError } = await supabase
    .from("person_studies")
    .upsert(studyInsert, { onConflict: "person_id,study_number" })
    .select("*")
    .single();

  if (studyError) {
    return { ok: false, error: studyError.message };
  }

  await supabase
    .from("people")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("id", input.id)
    .is("archived_at", null);

  const { data: event, error: eventError } = await supabase
    .from("person_events")
    .insert({
      person_id: input.id,
      event_type: "study_logged",
      title: `${study.title} logged`,
      body: notes
        ? `Completed on ${formatStudyDate(studiedAt)}. ${notes}`
        : `Completed on ${formatStudyDate(studiedAt)}.`,
      actor_profile_id: actor.actorProfileId,
    })
    .select("*")
    .single();

  if (eventError) {
    return { ok: false, error: eventError.message };
  }

  try {
    const studyCount = await countPersonStudies(input.id);
    await synchronizeAutomaticStudyStage(input.id, studyCount, actor.actorProfileId);
  } catch {
    // The study is already saved; leave the card where it is if auto-staging cannot sync.
  }

  revalidatePath("/");
  return { ok: true, data: { study, event } };
}

export async function updatePersonStudyTitle(
  input: UpdatePersonStudyTitleInput
): Promise<ActionResult<PersonStudy>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const actor = await validateActorProfile(input.actorProfileId);

  if ("error" in actor) {
    return { ok: false, error: actor.error };
  }

  const title = input.title.trim();

  if (!title) {
    return { ok: false, error: "Study name cannot be empty." };
  }

  if (title.length > 80) {
    return { ok: false, error: "Study name must be 80 characters or less." };
  }

  const patch: StudyUpdate = { title };
  const { data, error } = await supabase
    .from("person_studies")
    .update(patch)
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, data };
}

export async function updatePersonStudyNote(
  input: UpdatePersonStudyNoteInput
): Promise<ActionResult<PersonStudy>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const actor = await validateActorProfile(input.actorProfileId);

  if ("error" in actor) {
    return { ok: false, error: actor.error };
  }

  const patch: StudyUpdate = { notes: cleanOptional(input.notes) };
  const { data, error } = await supabase
    .from("person_studies")
    .update(patch)
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, data };
}

export async function deletePersonStudy(
  input: DeletePersonStudyInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const actor = await validateActorProfile(input.actorProfileId);

  if ("error" in actor) {
    return { ok: false, error: actor.error };
  }

  const { data: study } = await supabase
    .from("person_studies")
    .select("person_id")
    .eq("id", input.id)
    .maybeSingle();
  const { error } = await supabase.from("person_studies").delete().eq("id", input.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  if (study?.person_id) {
    try {
      const studyCount = await countPersonStudies(study.person_id);
      await synchronizeAutomaticStudyStage(
        study.person_id,
        studyCount,
        actor.actorProfileId
      );
    } catch {
      // The deletion succeeded; leave the card where it is if auto-staging cannot sync.
    }
  }

  revalidatePath("/");
  return { ok: true, data: { id: input.id } };
}

function formatStudyDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
