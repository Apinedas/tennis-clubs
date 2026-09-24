"use client";

import { useActionState } from "react";
import { requestLesson } from "@/app/actions/lesson-booking";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function RequestSlotButton({
  coachId,
  date,
  startsAtUtc,
  endsAtUtc,
  label,
}: {
  coachId: string;
  date: string;
  startsAtUtc: string;
  endsAtUtc: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(requestLesson, undefined);

  if (state?.message) {
    return <Alert>{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="coach_id" value={coachId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="starts_at" value={startsAtUtc} />
      <input type="hidden" name="ends_at" value={endsAtUtc} />
      <div className="flex flex-col gap-1">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Enviando…" : label}
        </Button>
        {state?.error && <span className="text-label-xs text-blocked-fg">{state.error}</span>}
      </div>
    </form>
  );
}
