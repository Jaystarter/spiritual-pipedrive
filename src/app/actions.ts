"use server";

import { revalidatePath } from "next/cache";

import { getStageLabel, isStageId, type StageId } from "@/lib/stages";
import { createSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type PersonRow = Database["public"]["Tables"]["people"]["Row"];
type PersonInsert = Database["public"]["Tables"]["people"]["Insert"];
type PersonUpdate = Database["public"]["Tables"]["people"]["Update"];
type EventInsert = Database["public"]["Tables"]["person_events"]["Insert"];
type StudyInsert = Database["public"]["Tables"]["person_studies"]["Insert"];
type StudyUpdate = Database["public"]["Tables"]["person_studies"]["Update"];

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

async function insertEvent(
  personId: string,
  event: Omit<EventInsert, "person_id">
) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return;
  }

  await supabase.from("person_events").insert({
    person_id: personId,
    ...event,
  });
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
  if (!isSupabaseConfigured()) {
    return {
      people: [],
      profiles: [],
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
      configured: true,
      error: error.message,
    };
  }

  const people = (data ?? []).filter(
    (person) => person.stage !== "baptized" || isCurrentMonth(person.baptized_at)
  );

  try {
    return {
      people: await hydratePeople(people),
      profiles: await listProfilesWithStats(people),
      configured: true,
    };
  } catch (profileError) {
    return {
      people: await hydratePeople(people),
      profiles: [],
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

  if (!isStageId(input.stage)) {
    return { ok: false, error: "Choose a valid stage." };
  }

  const sortOrder = await getNextSortOrder(input.stage);
  const baptizedAt =
    input.stage === "baptized" ? new Date().toISOString() : null;
  const insert: PersonInsert = {
    name,
    stage: input.stage,
    phone: cleanOptional(input.phone),
    teacher: assignedTeacherLabel(selectedProfiles.profiles),
    notes: cleanOptional(input.notes),
    assigned_profile_ids: normalizedProfiles.ids,
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
      input.stage === "hunting"
        ? "Started in Sowing Seeds."
        : `Started in ${getStageLabel(input.stage)}.`,
    to_stage: input.stage,
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

  if (input.stage && !isStageId(input.stage)) {
    return { ok: false, error: "Choose a valid stage." };
  }

  const patch: PersonUpdate = {};

  if (input.name !== undefined) {
    const name = input.name.trim();

    if (!name) {
      return { ok: false, error: "A card needs a name." };
    }

    patch.name = name;
  }

  if (input.stage) {
    patch.stage = input.stage;
    patch.baptized_at =
      input.stage === "baptized" ? new Date().toISOString() : null;
  }

  if (input.phone !== undefined) {
    patch.phone = cleanOptional(input.phone);
  }

  if (input.notes !== undefined) {
    patch.notes = cleanOptional(input.notes);
  }

  if (input.lifeStatus !== undefined) {
    const lifeStatus = cleanLifeStatus(input.lifeStatus);

    if (lifeStatus === undefined) {
      return { ok: false, error: "Choose student, worker, or clear the status." };
    }

    patch.life_status = lifeStatus;
  }

  if (input.nextFollowUpAt !== undefined) {
    patch.next_follow_up_at = cleanDate(input.nextFollowUpAt);
  }

  if (input.lastContactedAt !== undefined) {
    patch.last_contacted_at = cleanDate(input.lastContactedAt);
  }

  if (input.assignedProfileIds !== undefined) {
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

  await insertEvent(data.id, {
    event_type: "details_updated",
    title: "Details updated",
    body: "Contact information, assigned profiles, notes, or follow-up details changed.",
    actor_profile_id: actor.actorProfileId,
  });

  revalidatePath("/");
  return { ok: true, data: { ...data, events: [], studies: [] } };
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

  if (!isStageId(input.stage)) {
    return { ok: false, error: "Choose a valid stage." };
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
      title: `Moved to ${getStageLabel(input.stage)}`,
      body: fromStage
        ? `Moved from ${getStageLabel(fromStage)} to ${getStageLabel(input.stage)}.`
        : `Moved to ${getStageLabel(input.stage)}.`,
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

  const { error } = await supabase.from("person_studies").delete().eq("id", input.id);

  if (error) {
    return { ok: false, error: error.message };
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
