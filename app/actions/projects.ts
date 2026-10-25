"use server";

import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { describeError } from "@/lib/log";
import { createProject, type CreateProjectError } from "@/lib/projects/create";

export type NewProjectState = { error: CreateProjectError | null; id: string | null };

/** New project from the clients column. Signed-in only; the dialog then opens the new, empty chat. */
export async function createProjectAction(_previous: NewProjectState, formData: FormData): Promise<NewProjectState> {
  await requireSession();
  try {
    const result = await createProject(getDb(), formData.get("name"));
    return result.ok ? { error: null, id: result.id } : { error: result.error, id: null };
  } catch (error) {
    console.error(`createProjectAction failed: ${describeError(error)}`);
    return { error: "server", id: null };
  }
}
