"use server";

import { revalidatePath } from "next/cache";

import { isStageId, type StageId } from "@/lib/stages";
import { createSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type BoardPerson = Database["public"]["Tables"]["people"]["Row"];

export type BoardState = {
  people: BoardPerson[];
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
  teacher?: string;
  notes?: string;
};

type UpdatePersonInput = Partial<Omit<PersonInput, "stage">> & {
  id: string;
  stage?: StageId;
};

type MovePersonInput = {
  id: string;
  stage: StageId;
  orderedIds: string[];
};

function cleanOptional(value?: string) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
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

export async function listPeople(): Promise<BoardState> {
  if (!isSupabaseConfigured()) {
    return {
      people: [],
      configured: false,
      error:
        "Supabase is not configured yet. Add SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel.",
    };
  }

  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return {
      people: [],
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
      configured: true,
      error: error.message,
    };
  }

  const people = (data ?? []).filter(
    (person) => person.stage !== "baptized" || isCurrentMonth(person.baptized_at)
  );

  return {
    people,
    configured: true,
  };
}

export async function createPerson(
  input: PersonInput
): Promise<ActionResult<BoardPerson>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
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

  const { data, error } = await supabase
    .from("people")
    .insert({
      name,
      stage: input.stage,
      phone: cleanOptional(input.phone),
      teacher: cleanOptional(input.teacher),
      notes: cleanOptional(input.notes),
      sort_order: sortOrder,
      baptized_at: baptizedAt,
    })
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, data };
}

export async function updatePerson(
  input: UpdatePersonInput
): Promise<ActionResult<BoardPerson>> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  if (input.stage && !isStageId(input.stage)) {
    return { ok: false, error: "Choose a valid stage." };
  }

  const patch: Database["public"]["Tables"]["people"]["Update"] = {};

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

  if (input.teacher !== undefined) {
    patch.teacher = cleanOptional(input.teacher);
  }

  if (input.notes !== undefined) {
    patch.notes = cleanOptional(input.notes);
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

  revalidatePath("/");
  return { ok: true, data };
}

export async function movePerson(
  input: MovePersonInput
): Promise<ActionResult> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  if (!isStageId(input.stage)) {
    return { ok: false, error: "Choose a valid stage." };
  }

  const orderedIds = Array.from(new Set(input.orderedIds));
  const idsToUpdate = orderedIds.includes(input.id)
    ? orderedIds
    : [input.id, ...orderedIds];

  const updates = idsToUpdate.map((id, index) => {
    const movedCard = id === input.id;
    const update: Database["public"]["Tables"]["people"]["Update"] = {
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

  revalidatePath("/");
  return { ok: true };
}

export async function archivePerson(id: string): Promise<ActionResult> {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

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
