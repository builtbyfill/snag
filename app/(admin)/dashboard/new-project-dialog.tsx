"use client";

import { CircleAlertIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useId, useRef, useState } from "react";
import { createProjectAction, type NewProjectState } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { adminCopy } from "@/lib/copy/admin";
import { cn } from "@/lib/utils";

const initial: NewProjectState = { error: null, id: null };

/**
 * "New project" and its dialog: one name field. A created project opens as an empty chat with
 * its report link ready to copy. Native <dialog>, so focus, Esc and the backdrop come for free.
 */
export function NewProjectDialog({ variant = "row" }: { variant?: "row" | "button" }) {
  const c = adminCopy.newProject;
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();

  const [state, formAction, pending] = useActionState(async (previous: NewProjectState, formData: FormData) => {
    const next = await createProjectAction(previous, formData);
    if (next.id) {
      dialogRef.current?.close();
      router.push(`/dashboard?project=${next.id}`);
    }
    return next;
  }, initial);
  // The action state outlives the dialog; an error already shown stays hidden after closing.
  const [dismissed, setDismissed] = useState<NewProjectState | null>(null);
  const error = state === dismissed ? null : state.error;

  return (
    <>
      {variant === "row" ? (
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-body text-ink-secondary transition-colors hover:bg-hover hover:text-ink pointer-coarse:h-11"
        >
          <PlusIcon className="size-4 shrink-0" aria-hidden />
          {c.title}
        </button>
      ) : (
        <Button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="h-9 gap-1.5 rounded-lg px-3.5 text-body font-semibold hover:bg-primary-hover pointer-coarse:h-11"
        >
          <PlusIcon className="size-4" aria-hidden />
          {c.title}
        </Button>
      )}

      <dialog
        ref={dialogRef}
        data-zoom
        aria-labelledby={`${fieldId}-title`}
        onClose={() => {
          formRef.current?.reset();
          setDismissed(state);
        }}
        className="m-auto w-[min(92vw,400px)] rounded-xl border border-line-medium bg-surface p-0 text-ink backdrop:bg-sunken/80"
      >
        <form ref={formRef} action={formAction} aria-busy={pending} className="flex flex-col p-5">
          <h2 id={`${fieldId}-title`} className="text-title text-ink">
            {c.title}
          </h2>
          <label htmlFor={fieldId} className="mt-4 mb-1.5 text-meta font-medium text-ink-secondary">
            {c.label}
          </label>
          <input
            id={fieldId}
            name="name"
            autoComplete="off"
            maxLength={60}
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${errorId} ${hintId}` : hintId}
            className={cn(
              "h-10 w-full rounded-lg border bg-sunken px-3 text-body text-ink pointer-coarse:h-11",
              error ? "border-2 border-ink px-[11px]" : "border-line-strong",
            )}
          />
          {error && (
            <p id={errorId} role="alert" className="mt-2 flex items-start gap-2 text-meta font-medium text-ink">
              <CircleAlertIcon className="mt-px size-4 shrink-0" aria-hidden />
              {c.errors[error]}
            </p>
          )}
          <p id={hintId} className="mt-2 text-meta text-ink-muted">
            {c.hint}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => dialogRef.current?.close()}
              className="h-9 rounded-lg px-3.5 text-body text-ink-secondary hover:bg-hover hover:text-ink pointer-coarse:h-11"
            >
              {c.cancel}
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg px-3.5 text-body font-semibold hover:bg-primary-hover pointer-coarse:h-11"
            >
              {pending ? (
                <>
                  <Spinner className="size-4" aria-hidden />
                  {c.creating}
                </>
              ) : (
                c.create
              )}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
