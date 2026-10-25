"use client";

import { CircleAlertIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { adminCopy } from "@/lib/copy/admin";
import { EditableField } from "./editable-field";

const c = adminCopy.ticket;

export type FieldsView = {
  id: string;
  extractionState: "pending" | "extracted" | "extraction_failed";
  interrupted: boolean;
  extractionError: string | null;
  location: string;
  actualResult: string;
  tags: string;
  expectedResult: string;
  expectedResultEvidence: string | null;
  stepsToReproduce: string;
  stepsToReproduceEvidence: string | null;
  /** What the extraction wrote per field, as text (null: it left the field empty); absent without an extraction. */
  ai: Partial<Record<"location" | "actualResult" | "tags" | "expectedResult" | "stepsToReproduce", string | null>>;
  edited: string[];
};

/** Under an inferred field: where the suggestion came from, that you edited or added it, or the gap with Add. */
function Below({ value, evidence, edited, onAdd }: { value: string; evidence: string | null; edited: boolean; onAdd: () => void }) {
  if (value && evidence) {
    return (
      <p className="mt-1 text-meta break-words whitespace-pre-line text-ink-muted">
        <span className="font-medium text-marker-ink">{c.basedOn}</span> {evidence}
      </p>
    );
  }
  if (value) return <p className="mt-1 text-meta text-ink-muted">{edited ? c.editedByYou : c.addedByYou}</p>;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-2 text-meta text-ink-muted">
      {c.notEnough}
      <button type="button" onClick={onAdd} className="h-6 rounded-md border border-line-strong px-2 font-medium text-ink transition-colors hover:bg-hover pointer-coarse:h-11">
        {c.add}
      </button>
    </p>
  );
}

/**
 * The right column: "From the screenshot" (the observed fields), a divider, then "Suggested by
 * AI" with an evidence line under each field or the honest gap with Add. Every field saves when
 * you leave it.
 */
export function TicketFields({ ticket }: { ticket: FieldsView }) {
  if (ticket.extractionState === "pending") return <PendingFields />;
  const shared = (field: keyof FieldsView["ai"]) => ({
    ticketId: ticket.id,
    aiOriginal: field in ticket.ai ? ticket.ai[field] : undefined,
    edited: ticket.edited.includes(field),
  });

  return (
    <div className="flex flex-col gap-6">
      {ticket.extractionState === "extraction_failed" && (
        <div className="rounded-xl border border-danger p-4">
          <p className="flex items-center gap-2 text-body font-semibold text-danger">
            <CircleAlertIcon className="size-4 shrink-0" aria-hidden />
            {c.failedTitle}
          </p>
          <p className="mt-1 text-body text-ink-secondary">
            {ticket.interrupted ? `${adminCopy.card.interrupted} ` : ""}
            {c.failedBody} {c.byHand}
          </p>
          {ticket.extractionError && (
            <details className="mt-2">
              <summary className="cursor-pointer text-meta font-medium text-ink-secondary">{c.details}</summary>
              <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-sunken p-3 font-mono text-meta whitespace-pre-wrap text-ink">{ticket.extractionError}</pre>
            </details>
          )}
        </div>
      )}

      <section aria-labelledby="observed">
        <h2 id="observed" className="text-body font-semibold text-ink">
          {c.observed}
        </h2>
        <p className="mt-0.5 text-meta text-ink-muted">{c.observedIntro}</p>
        <div className="mt-4 flex flex-col gap-4">
          <EditableField {...shared("location")} field="location" label={c.fields.location} value={ticket.location} placeholder={c.notFilled} />
          <EditableField {...shared("actualResult")} field="actualResult" label={c.fields.actualResult} value={ticket.actualResult} placeholder={c.notFilled} />
          <EditableField {...shared("tags")} field="tags" label={c.fields.tags} value={ticket.tags} placeholder={c.notFilled} hint={c.tagsHint} />
        </div>
      </section>

      <section aria-labelledby="suggested" className="rounded-r-lg border-l-2 border-marker-ink bg-marker-soft py-4 pr-4 pl-4">
        <h2 id="suggested" className="text-body font-semibold text-marker-ink">
          {c.suggested}
        </h2>
        <p className="mt-0.5 text-meta text-ink-muted">{c.suggestedIntro}</p>
        <div className="mt-4 flex flex-col gap-4">
          <EditableField
            {...shared("expectedResult")}
            field="expectedResult"
            label={c.fields.expectedResult}
            value={ticket.expectedResult}
            below={(open) => (
              <Below value={ticket.expectedResult} evidence={ticket.expectedResultEvidence} edited={ticket.edited.includes("expectedResult")} onAdd={open} />
            )}
          />
          <EditableField
            {...shared("stepsToReproduce")}
            field="stepsToReproduce"
            label={c.fields.stepsToReproduce}
            value={ticket.stepsToReproduce}
            hint={c.stepsHint}
            numbered
            below={(open) => (
              <Below value={ticket.stepsToReproduce} evidence={ticket.stepsToReproduceEvidence} edited={ticket.edited.includes("stepsToReproduce")} onAdd={open} />
            )}
          />
        </div>
      </section>
    </div>
  );
}

function PendingFields() {
  const labels = [c.fields.location, c.fields.actualResult, c.fields.tags, c.fields.expectedResult, c.fields.stepsToReproduce];
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <p className="flex items-center gap-2 text-body text-ink-secondary">
        <Spinner className="size-4" aria-hidden />
        {c.state.pending}
      </p>
      <p className="-mt-3 text-meta text-ink-muted">{c.pendingHint}</p>
      <dl className="flex flex-col gap-4" aria-hidden>
        {labels.map((label, i) => (
          <div key={label}>
            <dt className="text-meta font-medium text-ink-secondary">{label}</dt>
            <dd className="mt-2 h-3 rounded bg-sunken" style={{ width: `${[72, 88, 40, 60, 50][i]}%` }} />
          </div>
        ))}
      </dl>
    </div>
  );
}
