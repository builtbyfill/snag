"use client";

import { CircleAlertIcon } from "lucide-react";
import { useActionState, useEffect, useId, useRef } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { SnagMark } from "@/components/snag-mark";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { POSITIONING } from "@/lib/copy/brand";
import { adminCopy } from "@/lib/copy/admin";
import { cn } from "@/lib/utils";

const initial: LoginState = { error: null, attempt: 0 };

/**
 * One field, one button. A wrong code clears the field (React resets the form after the action)
 * and focus returns to it; the sixth try in 15 minutes disables the button.
 */
export function LoginForm({ locked: lockedOnLoad }: { locked: boolean }) {
  const c = adminCopy.login;
  const fieldId = useId();
  const errorId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(loginAction, initial);
  const error = state.error ?? (lockedOnLoad ? "locked" : null);
  const locked = error === "locked";

  useEffect(() => {
    if (state.attempt > 0) fieldRef.current?.focus();
  }, [state.attempt]);

  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      {/* The brand band: on top on a phone, a panel on the left from 1024px. */}
      <header data-chrome className="bg-chrome px-6 py-7 text-chrome-fg lg:flex lg:w-[42%] lg:max-w-[560px] lg:flex-col lg:justify-center lg:px-14">
        <div className="flex items-center gap-2.5">
          <SnagMark className="size-8 text-marker [--snag-mark-cut:var(--chrome)]" />
          <h1 className="text-title font-semibold tracking-tight">Snag</h1>
        </div>
        <p className="mt-3 max-w-[36ch] text-body text-chrome-fg-muted">{POSITIONING}</p>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <form action={formAction} aria-busy={pending} className="flex w-full max-w-[360px] flex-col">
          <label htmlFor={fieldId} className="mb-1.5 text-meta font-medium text-ink-secondary">
            {c.label}
          </label>
          <input
            ref={fieldRef}
            id={fieldId}
            name="code"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "h-10 w-full rounded-lg border bg-sunken px-3 text-body text-ink pointer-coarse:h-11",
              error ? "border-2 border-ink px-[11px]" : "border-line-strong",
            )}
          />

          {error && (
            <p id={errorId} role="alert" className="mt-2 flex items-start gap-2 text-meta font-medium text-ink">
              <CircleAlertIcon className="mt-px size-4 shrink-0" aria-hidden />
              <span>{c.errors[error]}</span>
            </p>
          )}

          <Button
            type="submit"
            disabled={locked || pending}
            className="mt-4 h-10 w-full rounded-lg text-body font-semibold transition-colors duration-(--motion-fast) hover:bg-primary-hover pointer-coarse:h-11"
          >
            {pending ? (
              <>
                <Spinner className="size-4" aria-hidden />
                {c.opening}
              </>
            ) : (
              c.submit
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}
